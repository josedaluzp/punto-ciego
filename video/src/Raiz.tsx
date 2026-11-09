import { Composition } from 'remotion';
import { Demo, duracionTotal } from './Demo';

export const FPS = 30;

export const Raiz: React.FC = () => (
  <Composition
    id="Demo"
    component={Demo}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={duracionTotal(FPS)}
  />
);
