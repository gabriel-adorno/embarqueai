import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

export const signUpSchema = z
  .object({
    name: z.string().min(3, 'Informe seu nome completo.'),
    email: z.string().email('Informe um e-mail válido.'),
    phone: z.string().optional(),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export const emailSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
});

export const otpSchema = z.object({
  token: z.string().min(4, 'Informe o código recebido.'),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export const vehicleSchema = z.object({
  type: z.string().min(2, 'Informe o tipo do veículo.'),
  plate: z.string().min(5, 'Informe a placa.'),
});

export const routeSchema = z.object({
  name: z.string().min(3, 'Informe o nome da rota.'),
  pointA: z.string().min(2, 'Informe o primeiro ponto.'),
  pointB: z.string().min(2, 'Informe o segundo ponto.'),
  pointC: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().min(3, 'Informe o nome do grupo.'),
  vehicle_id: z.string().min(1, 'Selecione um veículo.'),
  route_id: z.string().min(1, 'Selecione uma rota.'),
});
