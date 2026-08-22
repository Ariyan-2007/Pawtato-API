import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(5000),
  API_PREFIX: Joi.string().default('api'),
  APP_URL: Joi.string().uri().default('http://localhost:5000'),
  CORS_ORIGINS: Joi.string().allow('').default(''),

  MONGO_URI: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES: Joi.string().required(),
  REFRESH_SECRET: Joi.string().min(16).required(),
  REFRESH_EXPIRES: Joi.string().required(),

  MAIL_HOST: Joi.string().optional(),
  MAIL_PORT: Joi.number().optional(),
  MAIL_USER: Joi.string().optional(),
  MAIL_PASSWORD: Joi.string().optional(),
  MAIL_FROM: Joi.string().optional(),
});
