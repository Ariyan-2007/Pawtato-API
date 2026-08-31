import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Deliberately shaped to match PushSubscription.toJSON() exactly, so the
// frontend can POST the browser's own subscription object with no
// transformation: `fetch(..., { body: JSON.stringify(subscription) })`.
export class WebPushSubscriptionKeysDto {
  @ApiProperty({ description: "The subscription's P-256 ECDH public key." })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({ description: "The subscription's auth secret." })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class RegisterWebPushSubscriptionDto {
  @ApiProperty({
    description:
      "The push service URL PushChannel sends encrypted messages to — this subscription's unique identity.",
  })
  @IsUrl()
  endpoint!: string;

  @ApiProperty({ type: WebPushSubscriptionKeysDto })
  // IsNotEmptyObject is required alongside ValidateNested, not redundant
  // with it — ValidateNested alone skips validation entirely when `keys` is
  // missing (nothing to descend into), which let a request with `endpoint`
  // but no `keys` reach the service as `dto.keys === undefined` and crash
  // with a 500 on `dto.keys.p256dh` instead of a clean 400. Caught while
  // writing the frontend integration test suite.
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => WebPushSubscriptionKeysDto)
  keys!: WebPushSubscriptionKeysDto;
}

// A raw `@Query('endpoint') endpoint: string` left a missing query param as
// `undefined`, which Mongoose's driver then silently drops from the delete
// filter — `findOneAndDelete({ endpoint: undefined, userId })` executes as
// `findOneAndDelete({ userId })` and deletes an arbitrary one of the
// caller's own subscriptions instead of erroring. A validated DTO makes a
// missing/malformed endpoint a clean 400 instead.
export class UnregisterWebPushSubscriptionQueryDto {
  @ApiProperty({ description: "The subscription's endpoint URL to remove" })
  @IsUrl()
  endpoint!: string;
}
