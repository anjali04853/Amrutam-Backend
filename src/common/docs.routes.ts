import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const openapiDoc = YAML.parse(readFileSync(join(__dirname, '../../docs/openapi.yaml'), 'utf8'));

export const docsRouter = Router();
docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(openapiDoc));
