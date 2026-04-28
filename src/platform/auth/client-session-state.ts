'use client';

let authenticated = false;

export function setClientAuthenticated(value: boolean) {
  authenticated = value;
}

export function isClientAuthenticated() {
  return authenticated;
}
