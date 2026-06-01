export const questions = [
  { question: "The Great Wall of China is visible from space with the naked eye.", answer: false },
  { question: "Honey never spoils and can last thousands of years.", answer: true },
  { question: "Lightning never strikes the same place twice.", answer: false },
  { question: "Humans use only 10% of their brains.", answer: false },
  { question: "A day on Venus is longer than a year on Venus.", answer: true },
  { question: "Sharks are the only fish that can blink with both eyes.", answer: false },
  { question: "Octopuses have three hearts.", answer: true },
  { question: "The Eiffel Tower grows taller in summer due to heat expansion.", answer: true },
  { question: "Goldfish have a memory of only 3 seconds.", answer: false },
  { question: "Water boils at a lower temperature at higher altitudes.", answer: true },
  { question: "Bananas are technically berries, but strawberries are not.", answer: true },
  { question: "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.", answer: true },
  { question: "Mount Everest is the tallest mountain measured from Earth's center.", answer: false },
  { question: "A group of flamingos is called a flamboyance.", answer: true },
  { question: "The Amazon River flows into the Pacific Ocean.", answer: false },
  { question: "Diamonds can be made from peanut butter.", answer: true },
  { question: "Penguins are found in the Arctic.", answer: false },
  { question: "The word 'robot' was first used in a 1920 Czech play.", answer: true },
  { question: "Glass is technically a slow-moving liquid.", answer: false },
  { question: "A snail can sleep for up to 3 years.", answer: true },
  { question: "The dot over the letter 'i' is called a tittle.", answer: true },
  { question: "Humans share 50% of their DNA with bananas.", answer: true },
  { question: "The Pacific Ocean is larger than all of Earth's landmass combined.", answer: true },
  { question: "Cats can't taste sweetness.", answer: true },
  { question: "Elephants are the only animals that can't jump.", answer: false },
  { question: "A bolt of lightning contains enough energy to toast 100,000 slices of bread.", answer: true },
  { question: "Napoleon Bonaparte was unusually short for his time.", answer: false },
  { question: "The sun is approximately 93 million miles from Earth.", answer: true },
  { question: "Bats are blind.", answer: false },
  { question: "The human body contains enough iron to make a 3-inch nail.", answer: true },
];

export function getRandomQuestions(count = 10) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
