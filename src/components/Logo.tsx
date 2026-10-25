import Image from "next/image";
import logo from "../../brand/sisi-logo.svg";

// The brand mark (brand/sisi-logo.svg) with the wordmark, "kwa" in Maasai Red.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image src={logo} alt="" priority className="h-9 w-auto" />
      <span className="text-xl font-extrabold tracking-tight text-text">
        Sisi <span className="text-primary">kwa</span> Sisi
      </span>
    </span>
  );
}
