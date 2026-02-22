'use client';

import { useState, useEffect, forwardRef } from 'react';

type GlobeMethods = import('react-globe.gl').GlobeMethods;
type GlobeProps = import('react-globe.gl').GlobeProps;

interface GlobeClientProps extends GlobeProps {
  onGlobeReady?: () => void;
}

// Serve texture via API route for reliable loading (avoids static file caching issues)
function getEarthTextureUrl(): string {
  if (typeof window === 'undefined') return '/api/earth-texture';
  return `${window.location.origin}/api/earth-texture`;
}

export const GlobeClient = forwardRef<GlobeMethods, GlobeClientProps>(function GlobeClient(props, ref) {
  const [Globe, setGlobe] = useState<React.ComponentType<GlobeProps & { ref?: React.Ref<GlobeMethods> }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('react-globe.gl')
      .then((mod) => setGlobe(mod.default as React.ComponentType<GlobeProps & { ref?: React.Ref<GlobeMethods> }>))
      .catch((err) => setError(err?.message || 'Failed to load globe'));
  }, []);

  const setRef = (instance: GlobeMethods | null) => {
    if (typeof ref === 'function') ref(instance);
    else if (ref) (ref as React.MutableRefObject<GlobeMethods | null>).current = instance;
  };

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-black/80 text-cyan-400">
        <p className="font-mono text-sm">Globe error: {error}</p>
      </div>
    );
  }

  if (!Globe) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-black/80 text-slate-500">
        <p className="font-mono text-sm animate-pulse">Loading globe…</p>
      </div>
    );
  }

  const textureUrl = getEarthTextureUrl();
  return <Globe {...props} globeImageUrl={textureUrl} ref={setRef} onGlobeReady={props.onGlobeReady} />;
});
