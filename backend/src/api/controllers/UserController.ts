import type { Request, Response } from 'express';
import type { UserService } from '../../application/services/UserService';
import type { UserRole } from '../../domain/enums/UserRole';
import { requireUser } from '../../infrastructure/middlewares/authMiddleware';

/** Thin by design: parse the request, call the service, shape the response. */
export class UserController {
  constructor(private readonly userService: UserService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.userService.login(req.body);
    res.status(200).json(result);
  };

  createUser = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.createUser(req.body);
    res.status(201).json({ user });
  };

  listUsers = async (req: Request, res: Response): Promise<void> => {
    const users = await this.userService.listUsers({
      role: req.query.role as UserRole | undefined,
      isActive: req.query.isActive as boolean | undefined,
    });
    res.status(200).json({ users, total: users.length });
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    const result = await this.userService.updateUser(
      req.params.id as string,
      req.body,
      requireUser(req),
    );
    res.status(200).json(result);
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.resetPassword(req.params.id as string, req.body);
    res.status(200).json({ user });
  };

  getUser = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.getById(req.params.id as string);
    res.status(200).json({ user });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.userService.getById(requireUser(req).id);
    res.status(200).json({ user });
  };
}
