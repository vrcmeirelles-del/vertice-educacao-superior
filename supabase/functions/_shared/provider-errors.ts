/** Categorias fechadas: nunca devolva ou registre o corpo bruto do provedor. */
export function classifyEmailFailure(status: number, body: unknown) {
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = typeof data.name === "string" ? data.name : "";
  const message =
    typeof data.message === "string" ? data.message.toLowerCase() : "";
  if (/quota/.test(name))
    return {
      code: "email_quota",
      error:
        "Limite de envio de e-mails atingido no provedor. A administração deve conferir a cota antes de reenviar.",
    };
  if (
    status === 401 ||
    /api.?key|permission/.test(name) ||
    /api key/.test(message)
  )
    return {
      code: "email_credentials",
      error:
        "O provedor recusou a credencial de envio. A administração deve conferir a chave e as permissões de e-mail.",
    };
  if (
    status === 403 &&
    /testing emails|domain.*not verified|verify.*domain/.test(message)
  )
    return {
      code: "email_sender_domain",
      error:
        "O provedor bloqueou o remetente ou o domínio de envio. A administração deve conferir a verificação do domínio e o endereço remetente.",
    };
  if (status === 429)
    return {
      code: "email_rate_limit",
      error:
        "O provedor limitou a frequência de envios. Aguarde antes de tentar novamente.",
    };
  if (status === 403)
    return {
      code: "email_forbidden",
      error:
        "Envio não autorizado pelo provedor. A administração deve conferir as permissões da chave, o remetente e a conta de envio.",
    };
  if (status === 400 || status === 422)
    return {
      code: "email_invalid_request",
      error:
        "O provedor recusou os dados do envio. Confira o e-mail cadastrado e a configuração do remetente.",
    };
  return {
    code: "email_provider_unavailable",
    error:
      "O serviço de e-mail não confirmou o envio. Não reenvie em sequência; a administração deve conferir os registros do provedor.",
  };
}
