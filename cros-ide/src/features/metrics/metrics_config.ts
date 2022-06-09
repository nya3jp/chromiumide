// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid';
import {isGoogler} from './metrics_util';

// Rotate user ID every 180 days or less.
const expirationInMs = 180 * 24 * 60 * 60 * 1000;

// Special UID indicating the user is an external user and their metrics must not be collected.
const specialExternalUid = '@external';

// Generates a new user ID.
// Returns null if the user is not a Googler and their metrics must not be collected.
async function generateNewUserId(): Promise<string | null> {
  const thisIsGoogler = await isGoogler();
  return thisIsGoogler ? uuid.v4() : null;
}

const defaultConfigPath = path.join(
  os.homedir(),
  '.config/chromite/cros-ide.google-analytics-uid'
);

// Schema of the config file in JSON.
// Be careful on changing this schema as it might cause metrics to fluctuate.
interface ConfigData {
  // UUIDv4 or '@external'.
  userid: string;
  // Last update time in ISO8601 format.
  date: string;
}

// In-memory representation of the config file.
interface Config {
  // UUIDv4, or null which indicates that metrics must not be collected.
  userId: string | null;
  // Last update time.
  lastUpdate: Date;
}

function isConfigValid(config: Config): boolean {
  return Date.now() - config.lastUpdate.getTime() < expirationInMs;
}

async function writeConfigData(
  configPath: string,
  data: ConfigData
): Promise<void> {
  await fs.promises.mkdir(path.dirname(configPath), {recursive: true});
  await fs.promises.writeFile(configPath, JSON.stringify(data));
}

async function readConfigData(configPath: string): Promise<ConfigData> {
  const content = await fs.promises.readFile(configPath, {
    encoding: 'utf8',
    flag: 'r',
  });
  const data = JSON.parse(content);
  if (typeof data !== 'object') {
    console.info('Invalid metrics config file: not an object.');
  }
  if (typeof data.userid === 'string' && typeof data.date === 'string') {
    return data as ConfigData;
  }
  throw new Error('Corrupted metrics config file');
}

async function generateNewConfig(
  genNewUserId: typeof generateNewUserId = generateNewUserId,
  updateTime = new Date()
): Promise<Config> {
  return {
    userId: await genNewUserId(),
    lastUpdate: updateTime,
  };
}

function parseConfigData(data: ConfigData): Config {
  return {
    userId: data.userid === specialExternalUid ? null : data.userid,
    lastUpdate: new Date(data.date),
  };
}

async function saveConfig(configPath: string, config: Config): Promise<void> {
  const data: ConfigData = {
    userid: config.userId ?? specialExternalUid,
    date: config.lastUpdate.toISOString(),
  };
  await writeConfigData(configPath, data);
}

async function loadConfig(configPath: string): Promise<Config> {
  return parseConfigData(await readConfigData(configPath));
}

/**
 * Unconditionally generates and returns a user ID.
 */
export async function generateValidUserId(
  configPath = defaultConfigPath,
  genNewUserId: typeof generateNewUserId = generateNewUserId,
  updateTime = new Date()
): Promise<string | null> {
  const config = await generateNewConfig(genNewUserId, updateTime);
  await saveConfig(configPath, config);
  return config.userId;
}

/**
 * Returns the user ID. Generates a new user ID if it's not been generated yet,
 * or the user ID was generated long ago and needs reset.
 */
export async function getOrGenerateValidUserId(
  configPath = defaultConfigPath,
  genNewUserId: typeof generateNewUserId = generateNewUserId,
  updateTime = new Date()
): Promise<string | null> {
  try {
    const config = await loadConfig(configPath);
    if (isConfigValid(config)) {
      return config.userId;
    }
  } catch {
    // Ignore errors.
  }
  return await generateValidUserId(configPath, genNewUserId, updateTime);
}
