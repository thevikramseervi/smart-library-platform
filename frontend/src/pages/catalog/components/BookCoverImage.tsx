import { useState } from "react";

interface BookCoverImageProps {
  src: string;
  title: string;
  className?: string;
}

/** Keeps the cover placeholder visible until the image is fully loaded. */
export function BookCoverImage({ src, title, className = "" }: BookCoverImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`${className} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}
