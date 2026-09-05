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

  claim = async (req: Request, res: Response): Promise<void> => {
    const request = await this.requestService.claimRequest(req.params.id as string, requireUser(req));
    res.status(200).json({ request });
  };

  assign = async (req: Request, res: Response): Promise<void> => {
    const request = await this.requestService.assignRequest(
      req.params.id as string,
      req.body.assigneeId,
      requireUser(req),
    );
    res.status(200).json({ request });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const request = await this.requestService.updateStatus(
      req.params.id as string,
      req.body,
      requireUser(req),
    );
    res.status(200).json({ request });
  };

  getHistory = async (req: Request, res: Response): Promise<void> => {
    const history = await this.requestService.getHistory(req.params.id as string, requireUser(req));
    res.status(200).json({ history, total: history.length });
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const result = await this.requestService.listMyRequests(requireUser(req), {
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    res.status(200).json(result);
  };
}
