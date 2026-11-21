/**
 * Avalia 360° — contrato de mídia por questão (sem upload/storage).
 * Os registros devem ser resolvidos por serviço autenticado antes de aplicação,
 * exportação ou correção. Não aceitar URLs arbitrárias como fonte confiável.
 */
export type ImagePlacement = 'enunciado' | 'alternativa' | 'apoio';
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';
export interface QuestionImage {
  id: string;
  questionId: string;
  storageKey: string;
  sha256: string;
  mime: ImageMime;
  sizeBytes: number;
  width: number;
  height: number;
  placement: ImagePlacement;
  alternativeId?: string;
  order: number;
  caption?: string;
  altText: string;
  sourceCredit?: string;
  rightsStatus: 'autoral' | 'licenciado' | 'uso_autorizado';
}
export interface MediaIssue {
  code: string;
  imageId?: string;
  message: string;
}
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_PER_QUESTION = 12;
export const IMAGE_MIME_TYPES: readonly ImageMime[] = ['image/png','image/jpeg','image/webp'];
export function validateImageMetadata(questionId: string, images: QuestionImage[]): MediaIssue[] {
  const issues: MediaIssue[] = [];
  const ids = new Set<string>();
  const orderSlots = new Set<string>();
  const add = (code:string, imageId:string, message:string) => issues.push({code,imageId,message});
  if (images.length > IMAGE_MAX_PER_QUESTION) issues.push({
    code:'TOO_MANY_IMAGES',message:'A questão excede o limite de imagens.'});
  for (const im of images) {
    if (!im.id || ids.has(im.id)) add('DUPLICATE_IMAGE',im.id,'Identificador de imagem ausente ou duplicado.');
    ids.add(im.id);
    if (im.questionId !== questionId) add('OTHER_QUESTION_IMAGE',im.id,'Imagem pertence a outra questão.');
    if (!IMAGE_MIME_TYPES.includes(im.mime)) add('INVALID_IMAGE_MIME',im.id,'Formato não permitido.');
    if (!Number.isInteger(im.sizeBytes) || im.sizeBytes <= 0 || im.sizeBytes > IMAGE_MAX_BYTES)
      add('INVALID_IMAGE_SIZE',im.id,'Arquivo fora do limite permitido.');
    if (!Number.isInteger(im.width) || im.width <= 0 || !Number.isInteger(im.height) || im.height <= 0)
      add('INVALID_DIMENSIONS',im.id,'Dimensões inválidas.');
    if (!/^[a-f0-9]{64}$/i.test(im.sha256))
      add('MISSING_HASH',im.id,'Hash SHA-256 inválido.');
    if (!im.storageKey || im.storageKey.startsWith('/') || im.storageKey.includes('..') ||
        im.storageKey.includes('://'))
      add('INVALID_STORAGE_KEY',im.id,'Referência de armazenamento inválida.');
    if (!im.altText?.trim()) add('MISSING_ALT_TEXT',im.id,'Descrição acessível obrigatória.');
    if (!['autoral','licenciado','uso_autorizado'].includes(im.rightsStatus))
      add('UNVERIFIED_RIGHTS',im.id,'Registrar direito de uso da imagem.');
    if (!['enunciado','alternativa','apoio'].includes(im.placement))
      add('INVALID_PLACEMENT',im.id,'Posicionamento inválido.');
    if (im.placement === 'alternativa' && !im.alternativeId?.trim())
      add('MISSING_ALTERNATIVE',im.id,'Indicar a alternativa à qual a imagem pertence.');
    if (im.placement !== 'alternativa' && im.alternativeId)
      add('UNEXPECTED_ALTERNATIVE',im.id,'Alternativa não se aplica à posição informada.');
    if (!Number.isInteger(im.order) || im.order < 0)
      add('INVALID_ORDER',im.id,'Ordem inválida.');
    const slot = [im.placement,im.alternativeId||'',im.order].join(':');
    if (orderSlots.has(slot)) add('DUPLICATE_SLOT',im.id,'Duas imagens ocupam a mesma posição.');
    orderSlots.add(slot);
  }
  return issues;
}
