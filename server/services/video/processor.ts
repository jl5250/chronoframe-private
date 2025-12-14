import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import { getStorageManager } from '~~/server/plugins/3.storage'
import sharp from 'sharp'
import { withRetry, RetryPresets, RetryConditions } from '../../utils/retry'
import fs from 'fs/promises'
import os from 'os'

const execAsync = promisify(exec)

export interface VideoMetadata {
  width: number
  height: number
  duration: number
  videoCodec: string
  audioCodec?: string
  bitrate: number
  frameRate: number
  format: string
}

export interface ProcessedVideoData {
  metadata: VideoMetadata
  thumbnailBuffer: Buffer
}

const checkFFmpegAvailable = async (): Promise<boolean> => {
  try {
    await execAsync('ffmpeg -version')
    return true
  } catch {
    return false
  }
}

const extractVideoMetadata = async (videoPath: string): Promise<VideoMetadata | null> => {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
    )

    const data = JSON.parse(stdout)
    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio')

    if (!videoStream) {
      logger.chrono.error('No video stream found in file')
      return null
    }

    const width = videoStream.width || 0
    const height = videoStream.height || 0
    const duration = parseFloat(data.format?.duration || '0')
    const bitrate = parseInt(data.format?.bit_rate || '0')

    let frameRate = 0
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/')
      if (num && den) {
        frameRate = parseInt(num) / parseInt(den)
      }
    }

    return {
      width,
      height,
      duration,
      videoCodec: videoStream.codec_name || 'unknown',
      audioCodec: audioStream?.codec_name,
      bitrate,
      frameRate,
      format: data.format?.format_name || 'unknown',
    }
  } catch (error) {
    logger.chrono.error('Failed to extract video metadata:', error)
    return null
  }
}

const generateVideoThumbnail = async (
  videoPath: string,
  timestamp: number = 1
): Promise<Buffer | null> => {
  const tempOutputPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`)

  try {
    await execAsync(
      `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${tempOutputPath}"`
    )

    const thumbnailBuffer = await fs.readFile(tempOutputPath)

    await fs.unlink(tempOutputPath).catch(() => {})

    return thumbnailBuffer
  } catch (error) {
    logger.chrono.error('Failed to generate video thumbnail:', error)
    await fs.unlink(tempOutputPath).catch(() => {})
    return null
  }
}

export const processVideoMetadata = async (
  storageKey: string
): Promise<ProcessedVideoData | null> => {
  const ffmpegAvailable = await checkFFmpegAvailable()
  if (!ffmpegAvailable) {
    logger.chrono.error('FFmpeg is not available on this system')
    return null
  }

  const storageProvider = getStorageManager().getProvider()
  if (!storageProvider) {
    logger.chrono.error('Storage provider not available')
    return null
  }

  const tempVideoPath = path.join(os.tmpdir(), `video_${Date.now()}${path.extname(storageKey)}`)

  try {
    const videoBuffer = await storageProvider.get(storageKey)
    if (!videoBuffer) {
      logger.chrono.error(`Video not found in storage: ${storageKey}`)
      return null
    }

    await fs.writeFile(tempVideoPath, videoBuffer)

    const metadata = await withRetry(
      async () => {
        const meta = await extractVideoMetadata(tempVideoPath)
        if (!meta) {
          throw new Error('Failed to extract video metadata')
        }
        return meta
      },
      {
        ...RetryPresets.fast,
        timeout: 30000,
        retryCondition: RetryConditions.resourceErrors,
      },
      logger.chrono
    )

    const thumbnailTimestamp = Math.min(1, metadata.duration / 2)
    const rawThumbnail = await withRetry(
      async () => {
        const thumb = await generateVideoThumbnail(tempVideoPath, thumbnailTimestamp)
        if (!thumb) {
          throw new Error('Failed to generate video thumbnail')
        }
        return thumb
      },
      {
        ...RetryPresets.fast,
        timeout: 20000,
        retryCondition: RetryConditions.resourceErrors,
      },
      logger.chrono
    )

    const thumbnailBuffer = await sharp(rawThumbnail)
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()

    await fs.unlink(tempVideoPath).catch(() => {})

    logger.chrono.info(
      `Successfully processed video: ${metadata.width}x${metadata.height}, ${metadata.duration}s`
    )

    return {
      metadata,
      thumbnailBuffer,
    }
  } catch (error) {
    logger.chrono.error(`Video processing failed: ${storageKey}`, error)
    await fs.unlink(tempVideoPath).catch(() => {})
    return null
  }
}

export const isVideoFile = (fileName: string): boolean => {
  const videoExtensions = [
    '.mov', '.mp4', '.avi', '.mkv', '.webm',
    '.flv', '.wmv', '.m4v', '.3gp', '.mpeg', '.mpg'
  ]
  const ext = path.extname(fileName).toLowerCase()
  return videoExtensions.includes(ext)
}
