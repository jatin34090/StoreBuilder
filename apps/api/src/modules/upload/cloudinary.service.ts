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

  // ─── Product images — stored under stores/{storeSlug}/products/{productId}/ ──

  async uploadProductImage(
    file: Express.Multer.File,
    productId: string,
    storeSlug = 'shared',
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          // Tenant-isolated path: stores/mystore/products/uuid/
          folder: `stores/${storeSlug}/products/${productId}`,
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary product image upload failed', error);
            reject(new BadRequestException('Image upload failed. Please try again.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(file.buffer);
    });
  }

  // ─── Avatar — stored under users/{userId}/ (platform-level, not per-store) ──

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `users/avatars`,
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

  // ─── Category image — stored under stores/{storeSlug}/categories/ ────────────

  async uploadCategoryImage(
    file: Express.Multer.File,
    categorySlug: string,
    storeSlug = 'shared',
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `stores/${storeSlug}/categories`,
          resource_type: 'image',
          width: 800,
          height: 1067,
          crop: 'fill',
          quality: 'auto:good',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Category image upload failed', error);
            reject(new BadRequestException(`Category image upload failed: ${error?.message ?? 'unknown'}`));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(file.buffer);
    });
  }

  // ─── Store logo/favicon ───────────────────────────────────────────────────

  async uploadStoreLogo(
    file: Express.Multer.File,
    storeSlug: string,
  ): Promise<CloudinaryUploadResult> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `stores/${storeSlug}/branding`,
          public_id: `logo`,
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'limit' },
            { quality: 'auto:good', fetch_format: 'auto' },
          ],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Store logo upload failed', error);
            reject(new BadRequestException('Logo upload failed. Please try again.'));
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
