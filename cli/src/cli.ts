/*
 * Copyright (C) 2018-2021 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { shutdown } from "@garden-io/core/build/src/util/util"
import { gardenEnv } from "@garden-io/core/build/src/constants"
import { getDefaultProfiler } from "@garden-io/core/build/src/util/profiling"
import { GardenProcess } from "@garden-io/core/build/src/db/entities/garden-process"
import { ensureConnected } from "@garden-io/core/build/src/db/connection"
import { GardenCli, RunOutput } from "@garden-io/core/build/src/cli/cli"
import { GardenPluginCallback } from "@garden-io/core/build/src/types/plugin/plugin"

// These plugins are always registered
export const getBundledPlugins = (): GardenPluginCallback[] =>
  [
    require("@garden-io/garden-conftest"),
    require("@garden-io/garden-conftest-container"),
    require("@garden-io/garden-conftest-kubernetes"),
    require("@garden-io/garden-jib"),
    require("@garden-io/garden-maven-container"),
    require("@garden-io/garden-terraform"),
  ].map((m) => () => m.gardenPlugin())

export async function runCli({
  args,
  cli,
  exitOnError = true,
}: { args?: string[]; cli?: GardenCli; exitOnError?: boolean } = {}) {
  let code = 0
  let result: RunOutput | undefined = undefined

  if (!args) {
    args = process.argv.slice(2)
  }

  await ensureConnected()
  const processRecord = await GardenProcess.register(args)

  try {
    if (!cli) {
      cli = new GardenCli({ plugins: getBundledPlugins() })
    }
    // Note: We slice off the binary/script name from argv.
    result = await cli.run({ args, exitOnError, processRecord })
    code = result.code
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.log(err.message)
    code = 1
  } finally {
    await processRecord.remove()
    await shutdown(code)
  }

  return { cli, result }
}
