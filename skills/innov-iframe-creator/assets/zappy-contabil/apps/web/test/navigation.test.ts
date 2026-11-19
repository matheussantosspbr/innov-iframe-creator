import { describe, expect, it } from 'vitest'
import {
  NAVIGATION_ACTION,
  navigationReducer,
  SCREEN,
  type Screen,
} from '../src/lib/navigation.tsx'

const home: Screen = { name: SCREEN.home }
const other: Screen = { name: SCREEN.home }

describe('Pilha de navegação em memória (navigationReducer)', () => {
  it('empilha a Screen despachada com push', () => {
    expect(navigationReducer([home], { type: NAVIGATION_ACTION.push, screen: other })).toEqual([
      home,
      other,
    ])
  })

  it('desempilha a Screen atual com back', () => {
    expect(navigationReducer([home, other], { type: NAVIGATION_ACTION.back })).toEqual([home])
  })

  it('mantém a primeira Screen quando back é despachado sem tela anterior', () => {
    expect(navigationReducer([home], { type: NAVIGATION_ACTION.back })).toEqual([home])
  })

  it('substitui a pilha inteira com reset', () => {
    expect(
      navigationReducer([home, other], { type: NAVIGATION_ACTION.reset, screen: home }),
    ).toEqual([home])
  })

  it('devolve uma pilha nova sem mutar a anterior (que está congelada para mutação lançar erro)', () => {
    const previous = Object.freeze([home])

    const next = navigationReducer(previous, { type: NAVIGATION_ACTION.push, screen: other })

    expect(next).not.toBe(previous)
    expect(previous).toEqual([home])
  })
})
