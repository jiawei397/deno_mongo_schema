import { expandGlob } from "https://deno.land/std@0.97.0/fs/mod.ts";

for await (const file of expandGlob(Deno.cwd() + "/**/*.ts")) {
  const fileContent = await Deno.readTextFile(file.path);
  let newContent;
  if (/\sSchema\s/.test(fileContent)) {
    newContent = fileContent.replaceAll(/\sSchema\s/g, " BaseSchema ");
  }
  if (/Schema,/.test(newContent || fileContent)) {
    newContent = (newContent || fileContent).replaceAll(
      /Schema,/g,
      "BaseSchema,",
    );
  }
  if (/SchemaDecorator/.test(fileContent)) {
    newContent = (newContent || fileContent).replaceAll(
      /SchemaDecorator/g,
      "Schema",
    );
  }

  if (newContent) {
    await Deno.writeTextFile(file.path, newContent);
  }
}
