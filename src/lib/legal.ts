/**
 * Política de Privacidade e Termos de Uso.
 *
 * ATENÇÃO: este texto é um RASCUNHO escrito a partir do que o app coleta de fato.
 * Antes de publicar nas lojas:
 *   1. Preencha `controller` e `contactEmail`.
 *   2. Peça revisão a alguém da área jurídica (há dados de crianças e localização).
 *   3. Publique o mesmo texto numa URL pública (as lojas pedem o link).
 *   4. Mude `reviewed` para true e atualize `version`/`updatedAt`.
 * Enquanto `reviewed` for false, as telas mostram "Versão preliminar".
 */
export const LEGAL = {
  version: '2026-11-07',
  updatedAt: '07/11/2026',
  reviewed: false,
  /** Nome (ou razão social) e CPF/CNPJ de quem responde pelos dados. */
  controller: '',
  /** E-mail para pedidos sobre dados pessoais (LGPD). */
  contactEmail: '',
};

export type LegalSection = { title: string; paragraphs: string[] };

const contact = () =>
  LEGAL.contactEmail
    ? `pelo e-mail ${LEGAL.contactEmail}`
    : 'pelo contato informado na loja de aplicativos';

export function privacyPolicy(): LegalSection[] {
  return [
    {
      title: 'Quem somos',
      paragraphs: [
        `O EmbarqueAI ajuda famílias a acompanhar o transporte escolar e transportadores a organizar rotas, veículos e passageiros. ${
          LEGAL.controller ? `O responsável pelo tratamento dos dados é ${LEGAL.controller}.` : ''
        }`.trim(),
      ],
    },
    {
      title: 'Dados que coletamos',
      paragraphs: [
        'Cadastro: nome, e-mail, telefone (opcional), senha (guardada de forma protegida) e o tipo de conta (passageiro/responsável ou transportador).',
        'Transporte: veículos (tipo, placa, lugares e foto opcional), rotas e pontos de parada (endereços), grupos e seus passageiros, ponto de embarque de cada passageiro, ausências avisadas, registros de embarque e desembarque, avisos do transportador e respostas.',
        'Localização: somente do aparelho do transportador e somente enquanto um trajeto está ao vivo, inclusive com o app fechado ou a tela bloqueada. A coleta para quando o trajeto é encerrado. Não coletamos a localização de passageiros ou responsáveis.',
        'Notificações: um identificador do aparelho para enviar avisos (push), se você permitir.',
      ],
    },
    {
      title: 'Para que usamos',
      paragraphs: [
        'Mostrar a posição do veículo e a previsão de chegada aos passageiros e responsáveis do grupo; avisar chegada, embarque, desembarque e atrasos; organizar rotas, grupos e o histórico de viagens; e manter sua conta funcionando. Não vendemos seus dados nem os usamos para publicidade.',
      ],
    },
    {
      title: 'Crianças e adolescentes',
      paragraphs: [
        'Quando o passageiro for criança ou adolescente, a conta e o acompanhamento devem ser feitos por um dos pais ou responsável legal, que consente com o uso dos dados descritos aqui. Coletamos apenas o necessário para o transporte.',
      ],
    },
    {
      title: 'Com quem compartilhamos',
      paragraphs: [
        'Dentro do app: o transportador vê os dados dos passageiros dos seus grupos; passageiros e responsáveis veem o veículo, o motorista e a viagem do seu grupo; um responsável só acompanha um passageiro depois que este aceita.',
        'Prestadores de serviço que operam o app: Supabase (banco de dados e login, servidores no Brasil), Cloudflare (servidor da API), Google Maps (endereços, rotas e mapas) e Expo (envio de notificações). Eles tratam os dados apenas para prestar esses serviços.',
      ],
    },
    {
      title: 'Por quanto tempo guardamos',
      paragraphs: [
        'Enquanto sua conta existir. Ao excluir a conta, apagamos seu perfil e os dados ligados a ela (no caso do transportador, também veículos, rotas, grupos e o histórico de viagens).',
      ],
    },
    {
      title: 'Seus direitos',
      paragraphs: [
        'Pela LGPD, você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão ou a portabilidade e revogar consentimentos. Nome, telefone e senha podem ser alterados na tela Conta, que também tem a opção "Excluir minha conta".',
        `Para os demais pedidos, fale conosco ${contact()}.`,
      ],
    },
    {
      title: 'Segurança',
      paragraphs: [
        'Os dados trafegam com criptografia (HTTPS) e o acesso no banco é restrito por regras que só deixam cada pessoa ver o que diz respeito a ela e aos seus grupos.',
      ],
    },
    {
      title: 'Mudanças nesta política',
      paragraphs: [
        'Se esta política mudar, avisaremos no app. A data da versão em vigor aparece no topo.',
      ],
    },
  ];
}

export function termsOfUse(): LegalSection[] {
  return [
    {
      title: 'Aceite',
      paragraphs: [
        'Ao criar uma conta no EmbarqueAI você concorda com estes Termos e com a Política de Privacidade.',
      ],
    },
    {
      title: 'O que o app faz',
      paragraphs: [
        'O EmbarqueAI é uma ferramenta de organização e acompanhamento. A contratação do transporte, os horários, o valor e a responsabilidade pela segurança dos passageiros são combinados diretamente entre as famílias e o transportador, que não é representado pelo app.',
      ],
    },
    {
      title: 'Sua conta',
      paragraphs: [
        'Use dados verdadeiros e mantenha sua senha em sigilo. Contas de passageiros menores de idade devem ser criadas e acompanhadas pelos pais ou responsáveis.',
        'O transportador se compromete a cadastrar apenas pessoas que autorizaram o uso dos seus dados e a usar a localização somente durante os trajetos.',
      ],
    },
    {
      title: 'Uso adequado',
      paragraphs: [
        'Não é permitido usar o app para fins ilegais, acessar dados de outras pessoas sem autorização ou tentar burlar a segurança do serviço. Contas que fizerem isso podem ser suspensas.',
      ],
    },
    {
      title: 'Localização e previsões',
      paragraphs: [
        'A posição do veículo e a previsão de chegada dependem de GPS, sinal de internet e serviços de mapas, e podem ter atrasos ou imprecisões. Não use o app como única fonte para decisões de segurança.',
      ],
    },
    {
      title: 'Disponibilidade',
      paragraphs: [
        'Trabalhamos para manter o app no ar, mas ele pode ficar indisponível por manutenção ou falhas de terceiros (internet, servidores, mapas, notificações).',
      ],
    },
    {
      title: 'Encerramento',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento na tela Conta.',
      ],
    },
    {
      title: 'Contato',
      paragraphs: [`Dúvidas sobre estes Termos: fale conosco ${contact()}.`],
    },
  ];
}
