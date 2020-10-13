import type HoprCoreConnector from '@hoprnet/hopr-core-connector-interface'
import type Hopr from '@hoprnet/hopr-core'
import { pubKeyToPeerId } from '@hoprnet/hopr-core/lib/utils'
import { moveDecimalPoint, u8aToHex } from '@hoprnet/hopr-utils'
import chalk from 'chalk'
import { getMyOpenChannelInstances } from '../utils/openChannels'
import { AbstractCommand } from './abstractCommand'
import { getPaddingLength, styleValue } from '../utils'

export default class ListOpenChannels extends AbstractCommand {
  constructor(public node: Hopr<HoprCoreConnector>) {
    super()
  }

  public name() {
    return 'openChannels'
  }

  public help() {
    return 'Lists your currently open channels'
  }

  private generateOutput({
    id,
    myBalance,
    totalBalance,
    peerId,
    status
  }: {
    id: string
    myBalance: string
    totalBalance: string
    peerId?: string
    status?: string
  }): string {
    const toDisplay: {
      name: string
      value: string
    }[] = [
      {
        name: 'Channel',
        value: styleValue(id, 'hash')
      },
      {
        name: 'CounterParty',
        value: peerId ? styleValue(peerId, 'peerId') : chalk.gray('pre-opened')
      },
      {
        name: 'Status',
        value: status ? styleValue(status, 'highlight') : chalk.gray('UNKNOWN')
      },
      {
        name: 'Total Balance',
        value: styleValue(totalBalance, 'number')
      },
      {
        name: 'My Balance',
        value: styleValue(myBalance, 'number')
      }
    ]

    const paddingLength = getPaddingLength(toDisplay.map((o) => o.name))

    return toDisplay.map((o) => `\n${o.name.padEnd(paddingLength)}:  ${o.value}`).join('')
  }

  /**
   * Lists all channels that we have with other nodes. Triggered from the CLI.
   */
  async execute(): Promise<string | void> {
    try {
      const { utils, types } = this.node.paymentChannels
      const self = await this.node.paymentChannels.account.address
      const channels = await getMyOpenChannelInstances(this.node)
      const result: string[] = []

      if (channels.length === 0) {
        return `\nNo open channels found.`
      }

      for (const channel of channels) {
        const id = u8aToHex(await channel.channelId)
        const counterParty = channel.counterparty

        if (!counterParty) {
          result.push(
            this.generateOutput({
              id,
              totalBalance: '0',
              myBalance: '0'
            })
          )
        } else {
          const selfIsPartyA = utils.isPartyA(self, counterParty)
          const totalBalance = moveDecimalPoint((await channel.balance).toString(), types.Balance.DECIMALS * -1)
          const myBalance = moveDecimalPoint(
            selfIsPartyA
              ? (await channel.balance_a).toString()
              : (await channel.balance).sub(await channel.balance_a).toString(),
            types.Balance.DECIMALS * -1
          )
          const peerId = (await pubKeyToPeerId(await channel.offChainCounterparty)).toB58String()
          const status = await channel.status

          result.push(
            this.generateOutput({
              id,
              totalBalance,
              myBalance,
              peerId,
              status
            })
          )
        }
      }

      return result.join('\n\n')
    } catch (err) {
      return styleValue(err.message, 'failure')
    }
  }
}
