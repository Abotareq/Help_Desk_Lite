process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-value-not-for-production';
process.env.JWT_EXPIRES_IN ??= '1h';
