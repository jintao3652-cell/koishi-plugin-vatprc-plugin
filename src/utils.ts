import dayjs from 'dayjs'
import { Context, Session } from 'koishi'

export class Utils {
  static formatTime(time: string): string {
    if (!time) return 'N/A'
    return dayjs(time).format('YYYY-MM-DD HH:mm')
  }

  static truncate(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  static escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
  }

  static createMessageCard(title: string, fields: Array<{ name: string, value: string }>): string {
    let message = `📌 ${title}\n`
    message += '─'.repeat(30) + '\n'
    fields.forEach(field => {
      message += `🔸 ${field.name}: ${field.value}\n`
    })
    return message
  }

  static async confirmAction(ctx: Context, session: Session, question: string): Promise<boolean> {
    await session.send(question + ' (回复 "是" 或 "否")')
    
    return new Promise((resolve) => {
      const dispose = ctx.on('message', (s) => {
        if (s.userId !== session.userId || s.channelId !== session.channelId) return
        
        const answer = s.content.toLowerCase().trim()
        if (answer === '是' || answer === 'yes' || answer === 'y') {
          dispose()
          resolve(true)
        } else if (answer === '否' || answer === 'no' || answer === 'n') {
          dispose()
          resolve(false)
        }
      })
      
      // 30秒后自动取消
      setTimeout(() => {
        dispose()
        resolve(false)
      }, 30000)
    })
  }

  static formatDuration(start: string, end: string): string {
    const startTime = dayjs(start)
    const endTime = dayjs(end)
    const duration = endTime.diff(startTime, 'minute')
    
    if (duration < 60) {
      return `${duration}分钟`
    } else if (duration < 1440) {
      return `${Math.floor(duration / 60)}小时${duration % 60}分钟`
    } else {
      return `${Math.floor(duration / 1440)}天${Math.floor((duration % 1440) / 60)}小时`
    }
  }

  static parseIcao(code: string): string {
    return code.toUpperCase().trim()
  }

  static isValidCallsign(callsign: string): boolean {
    return /^[A-Z]{3}[0-9]{1,4}[A-Z]?$/.test(callsign.toUpperCase())
  }
}