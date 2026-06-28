import { useEffect, RefObject } from 'react';

interface ParticlesOptions {
  selector: string;
  color?: string;
  density?: number;
  speed?: number;
}

/**
 * A hook to initialize particles.js in any component
 */
export const useParticles = ({ 
  selector, 
  color = '#ffffff', 
  density = 80, 
  speed = 2 
}: ParticlesOptions): void => {
  useEffect(() => {
    if (typeof window.particlesJS !== 'undefined') {
      window.particlesJS(selector, {
        particles: {
          number: { value: density, density: { enable: true, value_area: 800 } },
          color: { value: color },
          shape: {
            type: 'circle',
            stroke: { width: 0, color: '#000000' },
          },
          opacity: {
            value: 0.5,
            random: false,
            anim: { enable: false },
          },
          size: {
            value: 3,
            random: true,
            anim: { enable: false },
          },
          line_linked: {
            enable: true,
            distance: 150,
            color: color,
            opacity: 0.4,
            width: 1,
          },
          move: {
            enable: true,
            speed: speed,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false,
          },
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: { enable: true, mode: 'grab' },
            onclick: { enable: true, mode: 'push' },
            resize: true,
          },
          modes: {
            grab: { distance: 140, line_linked: { opacity: 1 } },
            push: { particles_nb: 4 },
          },
        },
        retina_detect: true,
      });
    }
  }, [selector, color, density, speed]);
}; 