import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

type ScreenshotProps = {
  src: string;
  alt: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  className?: string;
  chrome?: boolean;
};

export function Screenshot({
  src,
  alt,
  title = 'Open Presenter',
  caption,
  width = 1680,
  height = 927,
  className,
  chrome = true,
}: ScreenshotProps) {
  return (
    <figure className={className ? `doc-shot ${className}` : 'doc-shot'}>
      <div className="doc-shot-window">
        {chrome && (
          <div className="doc-shot-bar">
            <span className="doc-shot-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="doc-shot-title">{title}</span>
            <span className="doc-shot-badge">
              <span className="doc-shot-pulse" aria-hidden="true" />
              ao vivo
            </span>
          </div>
        )}
        <div className="doc-shot-body">
          <ImageZoom
            src={src}
            alt={alt}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px"
          >
            <img
              src={src}
              alt={alt}
              width={width}
              height={height}
              loading="lazy"
              className="doc-shot-img"
            />
          </ImageZoom>
        </div>
      </div>
      {caption && <figcaption className="doc-shot-caption">{caption}</figcaption>}
    </figure>
  );
}
