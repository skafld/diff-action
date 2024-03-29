const context = {
  eventName: 'push',
  repo: {
    owner: 'skafld',
    repo: 'diff-action'
  },
  payload: {
    before: '0000000',
    after: '0000000',
    pull_request: {
      base: {
        sha: '0000000'
      },
      head: {
        sha: '0000000'
      }
    }
  }
}

jest.mock('@actions/github', () => ({
  get context() {
    return context
  }
}))

import os from 'os'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import {env} from 'process'
import {resolve} from 'path'
import {randomUUID} from 'crypto'
import {readParams} from '../src/input'
import {expect, test, jest, beforeEach} from '@jest/globals'

beforeEach(() => {
  const filePath = resolve(__dirname, '../', 'action.yml')
  const contents = fs.readFileSync(filePath, 'utf8')
  const data = yaml.load(contents) as Record<'inputs', Map<string, any>>
  const inputs: Map<string, Record<'default', string>> = new Map(Object.entries(data.inputs))

  inputs.forEach((value, key) => {
    const envName = `INPUT_${key.toUpperCase()}`
    const envValue = value.default || ''

    env[envName] = envValue
  })

  env['GITHUB_REPOSITORY'] = 'skafld/diff-action'
  env['INPUT_TOKEN'] = randomUUID()
})

test('readParams modules', () => {
  env['INPUT_MODULES'] = `
      ---
      module1:
      module2: {}
      terraform:
        pattern: infra/terraform/*
      kubernetes:
        pattern: [infra/kubernetes/*]
  `.trim()

  const actual = readParams()

  expect(actual.modules.size).toEqual(4)

  expect(actual.modules.get('module1')).toMatchObject({
    name: 'module1',
    pattern: ['module1/**']
  })

  expect(actual.modules.get('module2')).toMatchObject({
    name: 'module2',
    pattern: ['module2/**']
  })

  expect(actual.modules.get('kubernetes')).toMatchObject({
    name: 'kubernetes',
    pattern: ['infra/kubernetes/*']
  })

  expect(actual.modules.get('terraform')).toMatchObject({
    name: 'terraform',
    pattern: ['infra/terraform/*']
  })
})

test('readParams modules from file', () => {
  const prefix = path.join(os.tmpdir(), 'diff-config-')
  const filename = path.join(fs.mkdtempSync(prefix), 'cfg.yaml')
  const data = yaml.dump({
    modules: {
      src: {
        tags: ['ts']
      },
      dist: {
        tags: ['js'],
        pattern: 'dist/*'
      },
      workflows: {
        pattern: ['.github/workflows/*']
      }
    }
  })

  fs.writeFileSync(filename, data)

  env['INPUT_CONFIG'] = filename

  const actual = readParams()

  expect(actual.modules.size).toEqual(3)

  expect(actual.modules.get('src')).toMatchObject({
    name: 'src',
    tags: ['ts'],
    pattern: ['src/**']
  })

  expect(actual.modules.get('dist')).toMatchObject({
    name: 'dist',
    tags: ['js'],
    pattern: ['dist/*']
  })

  expect(actual.modules.get('workflows')).toMatchObject({
    name: 'workflows',
    pattern: ['.github/workflows/*']
  })

  fs.unlinkSync(filename)
})

test('read default pull_request commit', () => {
  context.eventName = 'pull_request'
  context.payload.pull_request.base.sha = randomUUID()
  context.payload.pull_request.head.sha = randomUUID()

  const actual = readParams()

  expect(actual.base_ref).toEqual(context.payload.pull_request.base.sha)
  expect(actual.head_ref).toEqual(context.payload.pull_request.head.sha)
})

test('read default push commit', () => {
  context.eventName = 'push'
  context.payload.before = randomUUID()
  context.payload.after = randomUUID()

  const actual = readParams()

  expect(actual.base_ref).toEqual(context.payload.before)
  expect(actual.head_ref).toEqual(context.payload.after)
})

test('read input commit', () => {
  env['INPUT_HEAD_REF'] = randomUUID()
  env['INPUT_BASE_REF'] = randomUUID()

  const actual = readParams()

  expect(actual.base_ref).toEqual(env['INPUT_BASE_REF'])
  expect(actual.head_ref).toEqual(env['INPUT_HEAD_REF'])
})

test('read default repo', () => {
  const actual = readParams()

  expect(actual.repo_name).toEqual('diff-action')
  expect(actual.repo_owner).toEqual('skafld')
})

test('read input repo', () => {
  env['INPUT_REPO_NAME'] = randomUUID()
  env['INPUT_REPO_OWNER'] = randomUUID()

  const actual = readParams()

  expect(actual.repo_name).toEqual(env['INPUT_REPO_NAME'])
  expect(actual.repo_owner).toEqual(env['INPUT_REPO_OWNER'])
})
