export const toolAliasTextByName: Record<string, string> = {
  Dreamina: "Also known as: Seedream, Seedance, Jimeng",
  "Hailuo AI": "Also known as: MiniMax Video",
  Magnific: "Also known as: Freepik",
  "Gemini Notebook": "Also known as: Notebook LM",
  Windsurf: "Also known as: Devin Desktop",
};

export function getToolAliasText(toolName: string) {
  const matchingName = Object.keys(toolAliasTextByName).find(
    (name) => name.toLowerCase() === toolName.trim().toLowerCase(),
  );
  return matchingName ? toolAliasTextByName[matchingName] : undefined;
}
