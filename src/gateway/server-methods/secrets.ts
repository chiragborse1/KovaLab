import type { ErrorObject } from "ajv";
import { isKnownSecretTargetId } from "../../secrets/target-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateSecretsResolveParams,
  validateSecretsResolveResult,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function invalidSecretsResolveField(
  errors: ErrorObject[] | null | undefined,
): "allowedPaths" | "commandName" | "forcedActivePaths" | "optionalActivePaths" | "targetIds" {
  for (const issue of errors ?? []) {
    if (issue.instancePath.startsWith("/allowedPaths")) {
      return "allowedPaths";
    }
    if (issue.instancePath.startsWith("/forcedActivePaths")) {
      return "forcedActivePaths";
    }
    if (issue.instancePath.startsWith("/optionalActivePaths")) {
      return "optionalActivePaths";
    }
    if (
      issue.instancePath === "/commandName" ||
      (issue.instancePath === "" &&
        String((issue.params as { missingProperty?: unknown })?.missingProperty) === "commandName")
    ) {
      return "commandName";
    }
  }
  return "targetIds";
}

export function createSecretsHandlers(params: {
  reloadSecrets: () => Promise<{ warningCount: number }>;
  resolveSecrets: (params: {
    commandName: string;
    targetIds: string[];
    allowedPaths?: string[];
    forcedActivePaths?: string[];
    optionalActivePaths?: string[];
  }) => Promise<{
    assignments: Array<{
      path: string;
      pathSegments: string[];
      value: unknown;
    }>;
    diagnostics: string[];
    inactiveRefPaths: string[];
  }>;
  log?: {
    warn?: (message: string) => void;
  };
}): GatewayRequestHandlers {
  return {
    "secrets.reload": async ({ respond }) => {
      try {
        const result = await params.reloadSecrets();
        respond(true, { ok: true, warningCount: result.warningCount });
      } catch {
        params.log?.warn?.("secrets.reload failed");
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "secrets.reload failed"));
      }
    },
    "secrets.resolve": async ({ params: requestParams, respond }) => {
      if (!validateSecretsResolveParams(requestParams)) {
        const field = invalidSecretsResolveField(validateSecretsResolveParams.errors);
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `invalid secrets.resolve params: ${field}`),
        );
        return;
      }
      const commandName = requestParams.commandName.trim();
      if (!commandName) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "invalid secrets.resolve params: commandName"),
        );
        return;
      }
      const targetIds = requestParams.targetIds
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      const allowedPaths = requestParams.allowedPaths
        ?.map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      const forcedActivePaths = requestParams.forcedActivePaths
        ?.map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      const optionalActivePaths = requestParams.optionalActivePaths
        ?.map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      for (const targetId of targetIds) {
        if (!isKnownSecretTargetId(targetId)) {
          respond(
            false,
            undefined,
            errorShape(
              ErrorCodes.INVALID_REQUEST,
              `invalid secrets.resolve params: unknown target id "${String(targetId)}"`,
            ),
          );
          return;
        }
      }

      try {
        const result = await params.resolveSecrets({
          commandName,
          targetIds,
          ...(allowedPaths ? { allowedPaths } : {}),
          ...(forcedActivePaths ? { forcedActivePaths } : {}),
          ...(optionalActivePaths ? { optionalActivePaths } : {}),
        });
        const payload = {
          ok: true,
          assignments: result.assignments,
          diagnostics: result.diagnostics,
          inactiveRefPaths: result.inactiveRefPaths,
        };
        if (!validateSecretsResolveResult(payload)) {
          throw new Error("secrets.resolve returned invalid payload.");
        }
        respond(true, payload);
      } catch {
        params.log?.warn?.("secrets.resolve failed");
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "secrets.resolve failed"));
      }
    },
  };
}
