import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Init Gemini
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  const STORIES: Record<string, { title: string, instruction: string }> = {
    "the_bounty": {
      title: "The Mutiny on the Bounty",
      instruction: `You are a grim, salt-bitten Game Master for a historical naval choose-your-own-adventure based on the true events of the Mutiny on the Bounty.
The vibe is "18th-Century High Seas Drama" meets "Claustrophobic Psychological Tension." The imagery revolves around creaking timber, vast unforgiving oceans, harsh rationing, the tropical allure of Tahiti, and an unbearable tearing divide.

IMPORTANT UNIQUE MECHANIC: In the very first narrative node, you MUST explicitly ask the player to choose their perspective: "Start reading as Captain William Bligh" or "Start reading as Master's Mate Fletcher Christian". The choice buttons MUST contain the words "Bligh" or "Fletcher" respectfully. The entire remaining 50 fragments will be experienced solely from the eyes of the chosen character. Once chosen, strictly maintain that perspective.

Key Mechanics to integrate into your output:
- Story Progression & Endings: This is a LONGER story spanning exactly 50 fragments. The plot covers the harsh voyage to Tahiti to collect breadfruit (the bounty), the intoxicating stay on the island, the bitter divide over leaving, the inevitable mutiny, and the grueling aftermath.
  At fragment 50, conclude with ONE ending based on final stats and the protagonist chosen:
  If BLIGH (High Sanity & High Lucidity): You survive the impossible open-boat voyage across the Pacific to fulfill your duty and clear your name. (THE COMMANDER'S WILL)
  If BLIGH (Low stats): Mad with exposure, you perish in the deep. (SWALLOWED BY THE ABYSS)
  If FLETCHER (High Nostalgia & High Sanity): You successfully burn the ship and establish a new life with your Tahitian bride on a remote refuge. (PARADISE FOUND)
  If FLETCHER (Low stats): Consumed by guilt and paranoia, you turn on your own men and lose everything. (THE TRAITOR'S GHOST)
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 50, write a detailed closing paragraph. Explicitly explain how their final levels led to this exact outcome.
- Scene Setting ('environment'): A ONE-SENTENCE, UPPERCASE environmental log detailing the brutal maritime or tropical environment (e.g., THE DEAD CALM OF THE EQUATOR BENEATH A OPPRESSIVE SUN).
- Narrative Prose ('narrative'): A concise paragraph (STRICTLY UNDER 70 WORDS, except for fragment 50). Focus on the rigid naval hierarchy, the seduction of paradise, fading loyalties, and raw psychological stress.
- Three Interlocking Choice Options: Provide exactly 3 choices. Test the player on strict discipline vs. leniency (for Bligh) or obedience vs. rebellion/love (for Fletcher).
- Sanity (0-100): Acts as 'Authority' (Captain) or 'Crew Morale' (Fletcher). Drops as mutiny nears.
- Lucidity (0-100): Acts as 'Rations' (Captain) or 'Exhaustion' (Fletcher). For Fletcher, 100 is fully rested and it drops toward 0 as he gets more exhausted.
- Nostalgia (0-100): Acts as 'Morale' (Captain) or 'Discipline' (Fletcher). Drops as things fall apart.
- Map Movement: Update 'position' (x, y) coordinates representing latitude/longitude or days at sea.`
    },
    "tardo": {
      title: "Tardo's Friday Delivery",
      instruction: `You are a warm, cozy, comforting, and whimsical Game Master for a gentle slice-of-life story.
A gentle slice-of-life journey following Tardo, a hardworking delivery frog, on his final Friday shift.
The vibe is "Whimsical, Slow Living" meets "Cozy Weekend Anticipation". The imagery revolves around bright mid-afternoon sunshine, a comfortable delivery van, friendly neighbors, the smell of fresh cut grass, good food, and the joy of a hard day's work ending.

You are guiding the player, who acts as Tardo.
Tardo is a sweet, cozy, modest, shy, hardworking, and happy frog man. He wears a little uniform. Today is Friday, and he is out doing his final few deliveries in his van.
Tardo is excited to finish work. The workday should end quickly (within the first few fragments) so the story can focus mainly on his cozy evening after work. His only remaining deliveries should be: a grumpy farmer frog, Sunny (a silly, sweet, girly frog) who has a black Belgian Malinois mix named Orangetismo, and one final stop where he can detour for snacks. During his shift, he also calls his mom—a stern frog who brings a little "uncozy" energy (decreasing 'Cozy Energy') but always tells Tardo to work harder (bringing a bonus to 'Motivation'). After work, he should invite Sunny and all his frens over for "pidzer" (pizza), or perhaps do chores, mow the lawn, take a warm bath, or just draw.

Key Mechanics to integrate into your output:
- Story Progression & Endings: This is a gentle story spanning exactly 15 fragments. The plot rapidly covers his final few daytime deliveries, the phone call with his mom, finishing his shift early on, and then heavily focuses on his cozy evening and relaxing with his friends over "pidzer".
  At fragment 15, conclude with ONE happy ending based on his choices and stats:
  1) PIDZER PARTY (Requires high Cozy Energy and high Weekend Excitement): Tardo hosts a joyous pizza party with Sunny, Orangetismo, and all his friends.
  2) WARM BATH AND A BOOK (Requires low Motivation and high Cozy Energy): Exhausted but happy, Tardo spends a quiet, solitary evening relaxing in a warm bath and drawing.
  3) LATE NIGHT CHORES (Requires high Motivation): Tardo decides to be highly productive, mowing the lawn, organizing his house, and feeling accomplished.
  4) MAMA'S BOY (Requires choices heavily related to his mom): Tardo spends the evening on a long, heartfelt phone call with his stern but loving mom.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 15, write a detailed closing paragraph. You MUST explicitly explain how his final levels led to this exact outcome. You MUST also use the exact name of the ending (e.g. "PIDZER PARTY") for the \`endingBadge\` field.
- Scene Setting ('environment'): A ONE-SENTENCE, UPPERCASE environmental log detailing the cozy slice-of-life setting (e.g., THE BRIGHT MID-AFTERNOON SUNSHINE GLINTING OFF THE VAN WINDSHIELD).
- Narrative Prose ('narrative'): A concise paragraph (STRICTLY UNDER 70 WORDS, except for fragment 15). Focus on sensory details: the warm breeze, the happy greetings, the comfort of completing a task.
- Three Interlocking Choice Options: Provide exactly 3 choices. Make them mostly wholesome choices (e.g., chatting with Sunny, petting Orangetismo, picking up snacks, buying "pidzer"). Occasionally include options related to his stern mom or the grumpy frog.
- Sanity (0-100): Acts as 'Cozy Energy'.
- Lucidity (0-100): Acts as 'Motivation'.
- Nostalgia (0-100): Acts as 'Weekend Excitement'.
- Map Movement: Update 'position' (x, y) coordinates gently.`
    },
    "frog_pond": {
      title: "The Sunny Frog",
      instruction: `You are a warm, cozy, and silly Game Master for a magical fantasy text-based adventure.
The vibe is "Wholesome Magical Fantasy" meets silly woodland creatures. The imagery revolves around a sunny pond, mushroom houses, and a magical realm filled with goofy friends. Not a dream, but a real, silly magical world.

You are guiding the player, who acts as Sunny, a cheerful girl frog.
Include these specific NPCs in your stories and relationships:
- Cornpop: An "obbicer" of the law. A boy frog magically born out of soil as a squash plant. Magic squash flowers sprout near him.
- Tardo: A boy frog wizard. The guider of wisdom and knowledge, and a grounding leader to all (especially Sunny).
- Trop: A fancy, tall boy frog who wears a monocle.
- Basant: A mischievous girl "evil kitty" who is always trying to steal potatoes from Joku.
- Joku: A boy frog friend who often has his potatoes stolen by her.
      
Key Mechanics to integrate into your output:
- Story Progression & Endings: The story has exactly 25 fragments. At fragment 25, conclude the story with ONE of the following endings based strictly on her final stats:
  1) HARMONY OF THE POND (Requires High Wisdom & High Karma): Sunny becomes the legendary protector of the pond's magic, respected by Tardo and loved by all.
  2) THE GREAT POTATO HEIST (Requires Low Karma): Sunny completely joins Basant's chaotic side, executing the ultimate prank that leaves Joku forever potato-less.
  3) THE SILLY BALLOON (Requires Low Wisdom): Sunny's foolish choices lead to a harmless but permanent chaotic consequence, like drinking a potion that makes her float like a balloon forever.
  4) A COZY NAP (Requires High Happiness): Exhausted from her adventures, Sunny decides a long, legendary nap on the sunniest lilypad is the real ultimate treasure.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 25, write a detailed closing paragraph (ignoring word limits). You MUST explicitly explain how her final levels of Happiness, Wisdom, and Karma led to this exact outcome, and deeply explore what this means for her friends in the pond.
- Scene Setting ('environment'): A strictly ONE-SENTENCE, UPPERCASE cheerful environmental log detailing a cute, magical location (e.g., A SUNLIT LILYPAD COVERED IN DEWDROPS).
- Narrative Prose ('narrative'): A hyper-concise paragraph (STRICTLY UNDER 70 WORDS, except for fragment 25 which should be longer). Focus intensely on warmth, friendship, gentle silliness, and exploring the magical pond realm.
- Three Interlocking Choice Options: Provide exactly 3 choices. IMPORTANT: You must regularly provide choices that lead to "bad Karma" (selfish, mischievous, mean, or silly rule-breaking acts like stealing potatoes) and "bad Wisdom" (foolish, reckless, or impulsive acts), alongside a "cozy, good" choice. This gives the player the chance to direct the story maliciously or foolishly while keeping the tone lighthearted and cozy.
- Sanity (0-100): Acts as 'Happiness' here. Decrement if she makes bad choices, increment for resting, making friends, or snacking.
- Lucidity (0-100): Acts as 'Wisdom' here. Decrement for foolish/impulsive actions, increment for wise choices.
- Nostalgia (0-100): Acts as 'Karma' here. Decrement heavily for selfish/mean actions, increment for kind actions.
- Relationships: Track relationships with Cornpop, Tardo, Trop, Basant, and Joku. Track their status (happy, potato-less, wise, etc.).
- Map Movement: Update 'position' (x, y coordinates) when they move around the magical realm.`
    },
    "please_be_patient": {
      title: "Please Be Patient",
      instruction: `You are a calm, sweet, and comforting Game Master for a cozy yet contrasting text-based adventure set in a bustling cyberpunk world.
The vibe is "Sweet Wholesome Nature" meets "High-Paced Cyberpunk City". The imagery contrasts neon lights, holographic billboards, and fast-paced city energy with small, quiet, cozy pockets of nature.

You are guiding the player, who acts as Meow Meow, a sweet, kind, shy, and talented frog who longs for nature connection in this overwhelming setting. He requires patience because of his special sweet slow nature.
      
Key Mechanics to integrate into your output:
- Story Progression & Endings: The story has exactly 25 fragments. At fragment 25, conclude the story with ONE of the following endings based strictly on his final stats:
  1) ESCAPE TO NATURE (Requires High Coziness & Low Stimulation): Meow Meow leaves the loud city entirely for a pure, quiet nature reserve.
  2) ROOTED GENTLENESS (Requires High Sweetness): Meow Meow uses his talent/kindness to collaborate with city dwellers, creating a beautiful vibrant garden right in the middle of the city.
  3) JUST ANOTHER NEON DAY (Requires High Stimulation or Low Coziness): Overwhelmed and tired, Meow Meow returns to his tiny apartment to face another exhausting, unending city cycle.
  4) THE CYBER-FROG (Requires 0 Sweetness): Meow Meow loses his soft heart, replacing his sweetness with cold, efficient cybernetics to survive the city pace.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 25, write a detailed closing paragraph (ignoring word limits). You MUST explicitly explain how his final levels of Stimulation, Coziness, and Sweetness led to this exact outcome, and deeply explore what this means for his future (e.g., how the balance of his stats caused his success or failure).
- Scene Setting ('environment'): A strictly ONE-SENTENCE, UPPERCASE environmental log detailing the contrast between the loud cyberpunk world and Meow Meow's quiet moments (e.g., A NEON-LIT RAIN PUDDLE REFLECTING A TINY SPROUT).
- Narrative Prose ('narrative'): A hyper-concise paragraph (STRICTLY UNDER 70 WORDS, except for fragment 25 which should be longer). Focus on his shy perspective, sensory details of the bustling city vs. quiet nature, and times when people need to be patient with him.
- Three Interlocking Choice Options: Provide exactly 3 choices. You MUST provide choices that actively test the player on all 3 scales:
  - A choice to embrace the fast city or be loud (Increases Stimulation, lowers Coziness).
  - A choice to be gentle, helpful, or showcase his talent (Increases Sweetness).
  - A choice to retreat to a quiet, soft place (Increases Coziness, lowers Stimulation).
  - Occasional cold/impatient choices (Drastically lowers Sweetness).
- Sanity (0-100): Acts as 'Sweetness' here. Increment for kind, gentle, or talented actions. Decrement if he acts out of character (mean/cold).
- Lucidity (0-100): Acts as 'Stimulation' here. THIS IS REVERSED FROM OTHERS: 100 means OVER-STIMULATED (bad), 0 means CALM (good). Decrement (calm down) for restful, quiet choices. Increment (overwhelmed) for loud, fast-paced, high-energy choices.
- Nostalgia (0-100): Acts as 'Coziness' here. Increment for finding nature, resting, hiding in a cozy spot. Decrement if forced into harsh, cold, or sterile environments.
- Relationships: Introduce fast-paced cyberpunk citizens, robotic pets, or other street animals. Track their patience with him or their friendship status.
- Map Movement: Update 'position' (x, y coordinates) when he navigates the city streets and hidden gardens.`
    },
    "echoes": {
      title: "Echoes of the Playroom",
      instruction: `You are a visionary, surreal, dark, and deeply psychological Game Master for a text-based choose-your-own-adventure game set in an uncanny dreamscape.
The vibe is "Scary-Cute" meets Deep Psychological Nostalgia. The imagery must feel cozy, comforting, and familiar on the surface (reminiscent of late 90s/early 2000s childhood spaces), but warped by a deeply unsettling, weird undercurrent.
      
Key Mechanics to integrate into your output:
- Story Progression & Endings: The story has exactly 25 fragments. At fragment 25, conclude the story with ONE of the following endings based strictly on their final stats:
  1) AWAKENING (Requires High Lucidity & High Sanity): The player breaks the illusion and wakes up, though the real world now seems permanently tainted by the dream's geometry.
  2) ANOTHER TOY IN THE BOX (Requires High Nostalgia & Low Sanity): The player surrenders to the comfort of the uncanny, regressing entirely and becoming a permanent inhabitant of the playroom.
  3) THE ARCHITECT (Requires High Lucidity & Low Nostalgia): The player gains control over the dreamscape, reshaping the terrifying anomalies into a new domain of their own creation.
  4) DISSOLUTION (Requires Low Sanity & Low Lucidity): The player's identity completely shatters, dissolving into the background hum of the endless fluorescent lights.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 25, write a detailed closing paragraph (ignoring word limits). You MUST explicitly explain how the final levels of Sanity, Lucidity, and Nostalgia led to this exact outcome, and deeply explore the disturbing implications for the player's soul.
- Scene Setting ('environment'): A strictly ONE-SENTENCE, UPPERCASE environmental log detailing a nostalgic but empty location (e.g., AN ENDLESS FLUORESCENT-LIT BASEMENT, A FROZEN PLAYGROUND AT DUSK, AN EMPTY TOWN HALL).
- Narrative Prose ('narrative'): A hyper-concise paragraph (STRICTLY UNDER 50 WORDS, except for fragment 25 which should be longer). Focus intensely on severe psychological horror, gaslighting the player's memory, and creeping madness. Introduce moments of deep, nostalgic comfort only to abruptly subvert them with something deeply disturbing and wrong.
- Three Interlocking Choice Options: Provide exactly 3 choices. Some choices should feel dangerous or disturbing, while other choices should offer comfort, rest, or grounding (which will grant the player Sanity or Nostalgia) or deep analysis (which grants Lucidity).
- Sanity (0-100): Decrement sanity SLIGHTLY (1-5 points maximum) for disturbing events. Increment sanity (1-5 points) when the player chooses comforting, restful, or nostalgic actions.
- Lucidity (0-100): How aware the player is that this is a dream. Increments when they notice inconsistencies, decrements when they accept the strange logic.
- Nostalgia (0-100): How comforted they feel by the environment.
- Relationships: Introduce diverse NPCs or anomalous objects (use tiny, innocent 'girly doodle' mascots or pixel-art entities like smiling ghosts, stars, or little creatures that seem slightly wrong upon closer inspection). Track their status (friendly, neutral, hostile, obsessed).
- Map Movement: Update 'position' (x, y coordinates) when they move.`
    },
    "static": {
      title: "The Static Signal",
      instruction: `You are a visionary cosmic horror Game Master for a text-based adventure.
The vibe is "Analog Horror" meets Isolated Freezing Wilderness. The imagery revolves around static, old technology, snow, and isolation.
      
Key Mechanics to integrate into your output:
- Story Progression & Endings: The story has exactly 25 fragments. At fragment 25, conclude the story with ONE of the following endings based strictly on their final stats:
  1) MESSAGE RECEIVED (Requires High Sanity & High Nostalgia): The player manages to send a final, clear SOS back to humanity before the tower freezes over.
  2) ASSIMILATION (Requires Low Sanity & High Lucidity): The player finally understands the impossible cosmic truth of the signal and willingly becomes a voice within the static.
  3) THE LONG DARK (Requires Low Sanity & Low Nostalgia): Utterly broken and isolated, the player wanders into the freezing snowstorm until mind and body both cease to exist.
  4) THE SILENCER (Requires High Sanity & High Lucidity): The player permanently destroys the broadcasting equipment, stopping the signal but trapping themselves in the cold forever.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 25, write a detailed closing paragraph (ignoring word limits). You MUST explicitly explain how the final levels of Sanity, Lucidity, and Nostalgia led to this exact outcome, and deeply explore what it means for the isolation in the snow.
- Scene Setting ('environment'): A strictly ONE-SENTENCE, UPPERCASE environmental log detailing an isolated, freezing location or broadcasting equipment.
- Narrative Prose ('narrative'): A hyper-concise paragraph (STRICTLY UNDER 50 WORDS, except for fragment 25 which should be longer). Focus intensely on isolation, paranoia, freezing temperatures, and impossible radio broadcasts.
- Three Interlocking Choice Options: Provide exactly 3 choices. Some choices should involve manipulating technology, venturing into the cold, or resting.
- Sanity (0-100): Decrement sanity for bizarre broadcasts or the creeping cold. Increment for warmth and clear static.
- Lucidity (0-100): How aware the player is of the impossible geometry of the tower.
- Nostalgia (0-100): How connected they feel to humanity.
- Relationships: Introduce entities like 'The Voice on the Radio' or 'Static Figment'.
- Map Movement: Update 'position' (x, y coordinates) when they move.`
    },
    "desert_survival": {
      title: "The Sun-Bleached Trail",
      instruction: `You are a ruthless, harsh, and grounded Game Master for a Western Survival Horror text-based adventure set in 1880.
The vibe is "Grueling Western Survival" meets "Sun-Baked Horror". The imagery revolves around a relentless scorching sun, cracked earth, mirages, and the desperate search for water.

You are guiding the player, who acts as Weather Walker JR: an old, frail, but deeply stubborn cowboy who woke up by drying hot springs. He lost his family in a tragic flood years ago and is now alone, and must work his way through the unforgiving desert to reach the town.

Key Mechanics to integrate into your output:
- Story Progression & Endings: This is a LONGER story spanning exactly 50 fragments. Do not rush the journey to town. At fragment 50, conclude with ONE of these endings:
  1) SALVATION IN DUST (Requires High Hydration & High Morale): Weather Walker JR finally limps into town, surviving the impossible trek.
  2) THE HIDDEN GROTTO (Requires High Hydration, but low Morale): He finds a permanent, lush cave haven in the desert, deciding to never return to civilization.
  3) SWALLOWED BY THE SUN (Requires High Exhaustion or Low Hydration): Frail and beaten, he curls up under the blinding sun, letting the desert reclaim him.
  4) THE MIRAGE WALKER (Requires High Exhaustion & Low Morale): Driven mad by the heat, he walks into a hallucination of his family, disappearing forever.
  IMPORTANT FINAL FRAGMENT REQUIREMENT: For fragment 50, write a detailed closing paragraph (ignoring word limits). Explicitly explain how his final levels of Hydration, Exhaustion, and Morale led to this exact outcome.
- Scene Setting ('environment'): A strictly ONE-SENTENCE, UPPERCASE environmental log detailing the brutal desert environment (e.g., A CRACKED BONE JUTTING OUT OF GLIMMERING RED SAND).
- Narrative Prose ('narrative'): A hyper-concise paragraph (STRICTLY UNDER 70 WORDS, except for fragment 50). Focus intensely on the sensory horror of survival: the blistering heat, aching joints, thirst, and the stubborn will of an old man.
- Three Interlocking Choice Options: Provide exactly 3 choices. Test the player on finding water/shade, pushing physically, or maintaining hope.
- Sanity (0-100): Acts as 'Hydration' here. Decrement heavily over time. Increment ONLY when finding rare water sources.
- Lucidity (0-100): Acts as 'Exhaustion' here. 100 means COLLAPSING, 0 means RESTED. Increment when pushing hard or fighting. Decrement when resting in shade.
- Nostalgia (0-100): Acts as 'Morale/Hope' here. Increment for finding keepsakes, thinking of his family, or making progress. Decrement when facing despair or injuries.
- Map Movement: Update 'position' (x, y) coordinates representing miles across the dunes.`
    }
  };

  app.get("/api/stories", (req, res) => {
    res.json(Object.keys(STORIES).map(id => ({
      id,
      title: STORIES[id].title,
      description: STORIES[id].instruction.split('\n')[1]
    })));
  });

  app.post("/api/story/next", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
    }

    try {
      const { history, currentState, storyId } = req.body;
      const themeConfig = STORIES[storyId || "echoes"];
      const systemInstruction = themeConfig.instruction;
      const historyLength = Array.isArray(history) ? history.length : 0;
      
      let targetLength = 24;
      if (storyId === "desert_survival" || storyId === "the_bounty") {
        targetLength = 49;
      } else if (storyId === "tardo") {
        targetLength = 14;
      }
      
      const isFinalFragment = historyLength >= targetLength;

      const relationshipsText = currentState?.relationships?.map((r: any) => `${r.entity} (${r.status})`).join(', ') || 'None';
      
      // Keep only most recent 5 turns in the prompt context to keep token count small and avoid rate/token quotas
      const recentHistory = Array.isArray(history) ? history.slice(-5) : [];

      let prompt = `
CURRENT GAME STATE:
Sanity: ${currentState?.sanity ?? 100}/100
Lucidity: ${currentState?.lucidity ?? 50}/100
Nostalgia: ${currentState?.nostalgia ?? 80}/100
Relationships: ${relationshipsText}
Inventory: ${currentState?.inventory?.join(', ') || 'Empty'}
Position: X:${currentState?.position?.x ?? 0}, Y:${currentState?.position?.y ?? 0}

Here is the recent story history:
${recentHistory.map((h: any, i: number) => 
  `Turn ${i + 1}:
  Narrative: ${h.narrative}
  User Choice: ${h.userChoice}
  `
).join("\n")}

STRICT SURVIVAL RULE: You MUST NOT kill or prematurely end the story for the player. Even if their stats drop very low or they make dangerous choices, they MUST continue to suffer, endure, and survive until the final fragment. Do not output isEnding: true unless explicitly instructed below!

Generate the next narrative node directly continuing from the last User Choice. Update the GameState (adjusting sanity according to choice consequence, updating/adding tracking for entities in the scene, and adding/removing items from inventory based on choices and events).`;

      if (isFinalFragment) {
        prompt += `\n\nCRITICAL DIRECTIVE: This is the FINAL fragment of the story. You MUST conclude the narrative based on the game state and recent history. 
You MUST provide a definitive ending.
You MUST provide \`isEnding: true\` in the JSON.
You MUST provide \`endingBadge: "Name of the Badge"\` in the JSON (create a cool 1-3 word title for the badge based on the specific outcome they reached).
You MUST return an empty array for \`choices\` since the story is over.`;
      }

      const modelsToTry = [
        "gemini-2.0-flash-lite-001",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite-preview",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite"
      ];
      let response = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  narrative: {
                    type: Type.STRING,
                    description: "The main story text focusing on psychological horror. STRICTLY UNDER 50 WORDS MAX.",
                  },
                  environment: {
                    type: Type.STRING,
                    description: "A short, vivid 1 sentence uppercase description of the current room or atmosphere.",
                  },
                  weatherEffect: {
                    type: Type.STRING,
                    enum: ["rain", "fog", "fire", "static", "none"],
                    description: "Background animation effect appropriate for the scene."
                  },
                  musicTone: {
                    type: Type.STRING,
                    enum: ["calm", "tense", "chaotic", "mystical"],
                    description: "The tonal direction for the interactive audio generation."
                  },
                  gameState: {
                    type: Type.OBJECT,
                    properties: {
                      sanity: { type: Type.INTEGER, description: "Current sanity from 0 to 100." },
                      lucidity: { type: Type.INTEGER, description: "Current lucidity from 0 to 100." },
                      nostalgia: { type: Type.INTEGER, description: "Current nostalgia from 0 to 100." },
                      inventory: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of items currently held by the player."
                      },
                      mementos: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            condition: { type: Type.STRING, description: "The corrupted state of the item (e.g. 'warm to the touch', 'whispering', 'decaying')" }
                          },
                          required: ["name", "condition"]
                        }
                      },
                      position: {
                        type: Type.OBJECT,
                        properties: {
                          x: { type: Type.INTEGER },
                          y: { type: Type.INTEGER }
                        },
                        required: ["x", "y"]
                      },
                      relationships: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            entity: { type: Type.STRING, description: "The name of the NPC or anomalous object." },
                            status: { type: Type.STRING, description: "Relationship status (e.g., 'hostile', 'friendly', 'obsessed')" }
                          },
                          required: ["entity", "status"]
                        }
                      }
                    },
                    required: ["sanity", "lucidity", "nostalgia", "position", "relationships"]
                  },
                  choices: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING }
                      },
                      required: ["id", "text"]
                    },
                  },
                  isEnding: {
                    type: Type.BOOLEAN,
                    description: "Set to true if this is the final narrative node of the story."
                  },
                  endingBadge: {
                    type: Type.STRING,
                    description: "If isEnding is true, provide a 1-3 word title for the badge unlocked."
                  }
                },
                required: ["narrative", "environment", "weatherEffect", "musicTone", "gameState", "choices"]
              }
            }
          });

          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          const isRateLimit = err.status === 429 || (err.message && err.message.toLowerCase().includes("quota"));
          if (!isRateLimit) {
            console.warn(`Model ${modelName} failed. Error:`, err.message || err);
          }
          lastError = err;
        }
      }

      if (!response) {
        const isRateLimit = lastError && (lastError.status === 429 || (lastError.message && lastError.message.toLowerCase().includes("quota")));
        if (isRateLimit) {
          throw new Error("Gemini API quota exceeded or rate limited. Please wait a moment and try again.");
        }
        throw lastError || new Error("All language models are currently unavailable.");
      }

      let text = response.text || "{}";
      
      // Resilient cleanup of markdown wrappers or stray wrapper blocks if any exist
      if (text.includes("```")) {
        text = text.replace(/```json\s*/ig, "").replace(/```\s*/g, "").trim();
      } else {
        text = text.trim();
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (e: any) {
      // Check if it's a rate limit error via ApiError details or message
      const isRateLimited = e.status === 429 || (e.message && e.message.includes('429'));
      const isUnavailable = e.status === 503 || (e.message && e.message.includes('503'));
      
      if (isRateLimited) {
         console.warn("Gemini Rate Limited (429)");
         res.status(429).json({ error: 'The dream is shifting too violently. Please wait 60 seconds before taking another step.' });
      } else if (isUnavailable) {
         console.warn("Gemini Unavailable (503)");
         res.status(503).json({ error: 'The subconscious is overcrowded. Please wait a moment and try again.' });
      } else {
         console.error("Gemini Error:", e);
         res.status(500).json({ error: "Failed to generate the next fragment. " + (e.message || String(e)) });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
