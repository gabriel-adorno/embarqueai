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
    acceptTerms: z
      .boolean()
      .refine((value) => value, 'Para criar a conta, aceite os Termos e a Política de Privacidade.'),
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
  capacity: z.string().optional(),
});

export const routeSchema = z.object({
  name: z.string().min(3, 'Informe o nome da rota.'),
  points: z
    .array(z.object({ value: z.string().min(2, 'Informe o ponto.') }))
    .min(2, 'Informe pelo menos dois pontos.')
    .max(8, 'Use no máximo 8 pontos.'),
  group_ids: z.array(z.string()).min(1, 'Selecione pelo menos um grupo.'),
  outbound_time: z
    .string()
    .regex(/^$|^\d{2}:\d{2}$/, 'Use o formato HH:MM.')
    .optional(),
  return_time: z
    .string()
    .regex(/^$|^\d{2}:\d{2}$/, 'Use o formato HH:MM.')
    .optional(),
});

export const groupSchema = z.object({
  name: z.string().min(3, 'Informe o nome do grupo.'),
  vehicle_id: z.string().min(1, 'Selecione um veículo.'),
});
