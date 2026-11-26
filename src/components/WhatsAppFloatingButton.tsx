import { buildWhatsappLink } from '../lib/format';

interface WhatsAppFloatingButtonProps {
  whatsappNumber: string;
  storeName: string;
}

export function WhatsAppFloatingButton({
  whatsappNumber,
  storeName,
}: WhatsAppFloatingButtonProps) {
  const href = buildWhatsappLink(
    whatsappNumber,
    `Olá! Gostaria de falar com a ${storeName}.`
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Conversar no WhatsApp com a ${storeName}`}
      title="Falar no WhatsApp"
      className="fixed right-4 bottom-4 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(18,140,126,0.38)] ring-2 ring-white transition-all duration-200 hover:scale-105 hover:bg-[#1ebe5d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 active:scale-95 sm:right-6 sm:bottom-6 sm:h-14 sm:w-14"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 fill-current sm:h-7 sm:w-7"
        aria-hidden="true"
      >
        <path d="M16.004 3.2c-7.058 0-12.8 5.742-12.8 12.8 0 2.256.59 4.458 1.71 6.396L3.1 28.8l6.564-1.722a12.74 12.74 0 0 0 6.34 1.682h.006c7.056 0 12.796-5.742 12.796-12.8 0-3.42-1.332-6.634-3.75-9.052A12.717 12.717 0 0 0 16.004 3.2Zm0 23.38h-.004a10.57 10.57 0 0 1-5.388-1.474l-.386-.23-3.896 1.022 1.04-3.798-.252-.4a10.556 10.556 0 0 1-1.622-5.64c0-5.838 4.75-10.588 10.592-10.588 2.828 0 5.486 1.102 7.484 3.102a10.517 10.517 0 0 1 3.1 7.486c0 5.838-4.75 10.588-10.588 10.588Zm5.806-7.932c-.318-.16-1.882-.928-2.174-1.034-.292-.106-.504-.16-.716.16-.212.318-.822 1.034-1.008 1.246-.186.212-.372.238-.69.08-.318-.16-1.344-.496-2.56-1.58-.946-.844-1.584-1.886-1.77-2.204-.186-.318-.02-.49.14-.648.144-.144.318-.372.478-.558.16-.186.212-.318.318-.53.106-.212.054-.398-.026-.558-.08-.16-.716-1.726-.982-2.362-.258-.62-.52-.536-.716-.546-.186-.01-.398-.01-.61-.01-.212 0-.558.08-.85.398-.292.318-1.114 1.088-1.114 2.654 0 1.566 1.14 3.078 1.298 3.29.16.212 2.242 3.424 5.432 4.802.758.328 1.35.524 1.812.67.762.242 1.454.208 2.002.126.61-.092 1.882-.77 2.148-1.514.266-.744.266-1.38.186-1.514-.08-.132-.292-.212-.61-.372Z" />
      </svg>
    </a>
  );
}
