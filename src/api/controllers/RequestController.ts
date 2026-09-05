import type { Request, Response } from 'express';
import type { RequestService } from '../../application/services/RequestService';
import { requireUser } from '../../infrastructure/middlewares/authMiddleware';

export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const request = await this.requestService.createRequest(req.body, requireUser(req));
    res.status(201).json({ request });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const request = await this.requestService.getRequestById(req.params.id as string, requireUser(req));
    res.status(200).json({ request });
  };
}
