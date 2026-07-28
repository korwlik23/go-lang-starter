import { readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaUrl = new URL("../../releases/manifest.schema.json", import.meta.url);
let validatorPromise;

function errorPath(error) {
  if (error.keyword === "required") {
    return `${error.instancePath}/${error.params.missingProperty}`;
  }

  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${error.params.additionalProperty}`;
  }

  return error.instancePath || "/";
}

function normalizeErrors(errors = []) {
  return errors
    .map((error) => ({
      keyword: error.keyword,
      message: error.message ?? "validation failed",
      path: errorPath(error),
    }))
    .sort((left, right) =>
      `${left.path}:${left.keyword}`.localeCompare(
        `${right.path}:${right.keyword}`,
      ),
    );
}

async function loadValidator() {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  });

  addFormats(ajv);
  return ajv.compile(schema);
}

export async function validateManifest(manifest) {
  validatorPromise ??= loadValidator();
  const validator = await validatorPromise;
  const valid = validator(manifest);

  return {
    errors: valid ? [] : normalizeErrors(validator.errors),
    valid,
  };
}
