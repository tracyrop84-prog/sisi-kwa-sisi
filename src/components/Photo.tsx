import { photoUrl } from "@/lib/photos";

type Props = {
  path?: string; // a stored photo
  src?: string; // or a preview of one not uploaded yet
  alt: string;
  className?: string;
  eager?: boolean;
};

// Photos are already shrunk to 1600px on upload, so a plain <img> is enough;
// Next's image optimiser would only add cost.
export default function Photo({ path, src, alt, className = "", eager = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? photoUrl(path!)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`bg-black/5 object-cover ${className}`}
    />
  );
}
