import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadController } from './upload.controller';
import { CloudinaryService } from './cloudinary.service';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    ProductsModule,
    UsersModule,
    CategoriesModule,
  ],
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadModule {}
