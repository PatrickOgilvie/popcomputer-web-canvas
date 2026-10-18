// Guests: each visitor who joins in gets an account of their own, with a
// friendly name to paint under and nothing to remember. They stay, as their
// pixels do: the replay plays every one back.

const adjectives = ['Brave', 'Bright', 'Calm', 'Clever', 'Curious', 'Eager', 'Gentle', 'Happy', 'Jolly', 'Keen', 'Lively', 'Lucky', 'Merry', 'Nimble', 'Quick', 'Sunny', 'Swift', 'Witty']
const animals = ['Badger', 'Falcon', 'Fox', 'Hare', 'Heron', 'Lynx', 'Otter', 'Owl', 'Panda', 'Puffin', 'Robin', 'Seal', 'Squirrel', 'Swan', 'Tiger', 'Wren']

function pick(words: ReadonlyArray<string>): string {
  const [random = 0] = crypto.getRandomValues(new Uint32Array(1))
  return words[random % words.length] ?? 'Guest'
}

/** A guest's name, such as Curious Otter: Better Auth's anonymous plugin asks for one per guest. */
export const guestName = (): string => `${pick(adjectives)} ${pick(animals)}`
