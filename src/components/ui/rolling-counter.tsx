'use client';

import { motion, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect } from 'react';

type PlaceValue = number | '.';

type RollingCounterProps = {
  value: string;
  className?: string;
};

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number): number {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

function NumberColumn({ mv, number, height }: { mv: MotionValue<number>; number: number; height: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let next = offset * height;

    if (offset > 5) {
      next -= 10 * height;
    }

    return next;
  });

  return (
    <motion.span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        y,
      }}
    >
      {number}
    </motion.span>
  );
}

function Digit({ place, value, height }: { place: PlaceValue; value: number; height: number }) {
  if (place === '.') {
    return (
      <span className="relative inline-flex items-center justify-center" style={{ height, width: 'fit-content' }}>
        .
      </span>
    );
  }

  const valueRoundedToPlace = getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace, {
    stiffness: 180,
    damping: 24,
    mass: 0.8,
  });

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <span
      className="relative inline-flex overflow-hidden tabular-nums"
      style={{
        height,
        width: '1ch',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {Array.from({ length: 10 }, (_, index) => (
        <NumberColumn key={index} mv={animatedValue} number={index} height={height} />
      ))}
    </span>
  );
}

function buildPlaces(value: number): PlaceValue[] {
  return [...value.toString()].map((char, index, chars) => {
    if (char === '.') {
      return '.';
    }

    const dotIndex = chars.indexOf('.');
    const isInteger = dotIndex === -1;
    const exponent = isInteger ? chars.length - index - 1 : index < dotIndex ? dotIndex - index - 1 : -(index - dotIndex);
    return 10 ** exponent;
  });
}

export function RollingCounter({ value, className }: RollingCounterProps) {
  const numericValue = /^\d+$/.test(value) ? Number(value) : null;

  if (numericValue == null) {
    return <span className={className}>{value}</span>;
  }

  const places = buildPlaces(numericValue);
  const height = 13;

  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
          lineHeight: 1,
          direction: 'ltr',
        }}
      >
        {places.map((place, index) => (
          <Digit key={`${String(place)}-${index}`} place={place} value={numericValue} height={height} />
        ))}
      </span>
    </span>
  );
}
