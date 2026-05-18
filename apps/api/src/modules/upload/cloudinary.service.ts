import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { Express } from 'express';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadProductImage(
    file: Express.Multer.File,
    productId: string,
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `jewellery/products/${productId}`,
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            reject(new BadRequestException('Image upload failed. Please try again.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(file.buffer);
    });
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `jewellery/avatars`,
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Avatar upload failed', error);
            reject(new BadRequestException('Avatar upload failed. Please try again.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(file.buffer);
    });
  }

  async uploadCategoryImage(
    file: Express.Multer.File,
    categorySlug: string,
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `jewellery/categories`,
          public_id: `cat_${categorySlug}`,
          overwrite: true,
          transformation: [
            { width: 800, height: 600, crop: 'fill' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(new BadRequestException('Category image upload failed.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Deleted Cloudinary image: ${publicId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Cloudinary image ${publicId}`, error);
    }
  }

  getTransformedUrl(publicId: string, width: number, height: number): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum: 5 MB`,
      );
    }
  }

  private mapResult(result: UploadApiResponse): CloudinaryUploadResult {
    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }
}
