import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

const applyParsedRequest = (req: Request, parsed: any) => {
  if (!parsed || typeof parsed !== 'object') {
    return;
  }

  if ('body' in parsed) {
    req.body = parsed.body;
  }

  if ('query' in parsed) {
    req.query = parsed.query;
  }

  if ('params' in parsed) {
    req.params = parsed.params;
  }
};

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      applyParsedRequest(req, parsed);
      return next();
    } catch (error: any) {
      const issues = error instanceof ZodError ? error.issues : undefined;
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: issues,
      });
    }
  };
};

export const validateWith = (schemaFactory: (req: Request) => ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = schemaFactory(req);
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      applyParsedRequest(req, parsed);
      return next();
    } catch (error: any) {
      const issues = error instanceof ZodError ? error.issues : undefined;
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: issues,
      });
    }
  };
};
