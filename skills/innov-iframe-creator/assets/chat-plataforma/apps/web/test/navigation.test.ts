import { describe, expect, it } from 'vitest'
import {
  NAVIGATION_ACTION,
  navigationReducer,
  SCREEN,
  type Screen,
} from '../src/lib/navigation.tsx'
import { FIXTURE_TICKET_ID } from './fixtures.ts'

const home: Screen = { name: SCREEN.home }
const ticket: Screen = { name: SCREEN.ticket, ticketId: FIXTURE_TICKET_ID }

describe('Pilha de navegação em memória (navigationReducer)', () => {
  it('empilha a Screen despachada com push', () => {
    expect(navigationReducer([home], { type: NAVIGATION_ACTION.push, screen: ticket })).toEqual([
      home,
      ticket,
    ])
  })

  it('desempilha a Screen atual com back', () => {
    expect(navigationReducer([home, ticket], { type: NAVIGATION_ACTION.back })).toEqual([home])
  })

  it('mantém a primeira Screen quando back é despachado sem tela anterior', () => {
    expect(navigationReducer([home], { type: NAVIGATION_ACTION.back })).toEqual([home])
  })

  it('substitui a pilha inteira com reset', () => {
    expect(
      navigationReducer([home, ticket], { type: NAVIGATION_ACTION.reset, screen: home }),
    ).toEqual([home])
  })

  it('devolve uma pilha nova sem mutar a anterior (que está congelada para mutação lançar erro)', () => {
    const previous = Object.freeze([home])

    const next = navigationReducer(previous, { type: NAVIGATION_ACTION.push, screen: ticket })

    expect(next).not.toBe(previous)
    expect(previous).toEqual([home])
  })
})
