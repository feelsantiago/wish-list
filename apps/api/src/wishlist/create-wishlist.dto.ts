import { createZodDto } from 'nestjs-zod';
import { CreateWishlistRequest } from '@wish-list/wishlist-data';

export class CreateWishlistDto extends createZodDto(CreateWishlistRequest) {}
