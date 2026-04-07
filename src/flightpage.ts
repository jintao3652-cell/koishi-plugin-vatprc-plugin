import { Context, h } from 'koishi'
import { FlightScreenshot, ScreenshotOptions, FlightPageData } from './screenshot'
import { Utils } from './utils'

export function registerFlightPageCommands(ctx: Context, screenshot: FlightScreenshot) {
  
  // 航班页面截图命令
  ctx.command('vatprc.flightpage <flightId>', '查询航班页面并截图')
    .alias('vatprc.航班页面')
    .option('full', '-f 完整页面截图', { fallback: false })
    .option('width', '-w <width:number> 图片宽度', { fallback: 800 })
    .option('height', '-H <height:number> 图片高度', { fallback: 600 })
    .option('quality', '-q <quality:number> 图片质量 (1-100)', { fallback: 80 })
    .option('delay', '-d <delay:number> 延迟时间(毫秒)', { fallback: 2000 })
    .action(async ({ session, options }, flightId) => {
      if (!flightId) {
        return '请输入航班ID，例如: vatprc.flightpage CXA123'
      }
      
      const validFlightId = flightId.toUpperCase().trim()
      
      // 验证航班号格式
      if (!/^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/.test(validFlightId)) {
        return '航班ID格式不正确，应为航空公司代码+数字，例如: CXA123'
      }
      
      await session.send(`正在查询航班 ${validFlightId} 的机组状态...`)
      
      try {
        // 先尝试获取页面数据
        const pageData = await screenshot.getFlightDataFromPage(validFlightId)
        
        if (!pageData) {
          return `无法获取航班 ${validFlightId} 的信息。可能原因：\n` +
                 '1. 航班不存在或已结束\n' +
                 '2. 网站暂时不可用\n' +
                 '3. 需要登录查看（部分航班可能受限）'
        }
        
        // 发送航班信息摘要
        let infoMessage = '📊 航班信息摘要:\n'
        infoMessage += '='.repeat(30) + '\n'
        
        if (pageData.callsign) infoMessage += `呼号: ${pageData.callsign}\n`
        if (pageData.departure || pageData.arrival) {
          infoMessage += `航程: ${pageData.departure || '未知'} → ${pageData.arrival || '未知'}\n`
        }
        if (pageData.aircraft) infoMessage += `机型: ${pageData.aircraft}\n`
        if (pageData.status) infoMessage += `状态: ${pageData.status}\n`
        
        if (pageData.pilotName || pageData.pilotCid) {
          infoMessage += '\n👨‍✈️ 机组信息:\n'
          if (pageData.pilotName) infoMessage += `姓名: ${pageData.pilotName}\n`
          if (pageData.pilotCid) infoMessage += `CID: ${pageData.pilotCid}\n`
          if (pageData.pilotRating) infoMessage += `等级: ${pageData.pilotRating}\n`
        }
        
        if (pageData.connectTime || pageData.flightTime) {
          infoMessage += '\n⏱️ 时间信息:\n'
          if (pageData.connectTime) infoMessage += `连线时间: ${pageData.connectTime}\n`
          if (pageData.flightTime) infoMessage += `飞行时间: ${pageData.flightTime}\n`
        }
        
        await session.send(infoMessage)
        
        // 准备截图
        await session.send('正在生成截图...')
        
        const screenshotOptions: ScreenshotOptions = {
          width: Math.min(Math.max(options.width, 400), 1920),
          height: Math.min(Math.max(options.height, 300), 1080),
          quality: Math.min(Math.max(options.quality, 1), 100),
          delay: Math.min(Math.max(options.delay, 500), 10000),
          fullPage: options.full
        }
        
        const imageBuffer = await screenshot.getFlightScreenshot(validFlightId, screenshotOptions)
        
        if (!imageBuffer) {
          return '截图生成失败，请稍后重试'
        }
        
        // 发送图片
        await session.send(`航班 ${validFlightId} 机组状态截图:`)
        
        // 注意：发送图片的具体方式取决于 KOISHI 平台
        // 对于支持 Base64 的平台
        const base64Image = imageBuffer.toString('base64')
        await session.send(`[CQ:image,file=base64://${base64Image}]`)
        
        // 或者保存为临时文件发送
        // const tempPath = path.join(process.cwd(), 'temp', `${validFlightId}.jpg`)
        // fs.writeFileSync(tempPath, imageBuffer)
        // await session.send(`[CQ:image,file=file://${tempPath}]`)
        
        return '截图已发送'
        
      } catch (error: any) {
        ctx.logger.error(`航班页面查询失败: ${error.message}`)
        return `查询失败: ${error.message}`
      }
    })

  // 仅获取航班信息（不截图）
  ctx.command('vatprc.flightinfo <flightId>', '获取航班页面信息')
    .alias('vatprc.航班信息')
    .action(async ({ session }, flightId) => {
      if (!flightId) {
        return '请输入航班ID，例如: vatprc.flightinfo CXA123'
      }
      
      const validFlightId = flightId.toUpperCase().trim()
      
      await session.send(`正在获取航班 ${validFlightId} 的信息...`)
      
      try {
        const pageData = await screenshot.getFlightDataFromPage(validFlightId)
        
        if (!pageData) {
          return `无法获取航班 ${validFlightId} 的信息`
        }
        
        // 格式化航班信息
        let message = Utils.createMessageCard(`航班 ${validFlightId}`, [
          { name: '呼号', value: pageData.callsign || '未知' },
          { name: '状态', value: pageData.status || '未知' },
          { name: '航程', value: `${pageData.departure || '未知'} → ${pageData.arrival || '未知'}` },
          { name: '机型', value: pageData.aircraft || '未知' }
        ])
        
        // 机组信息
        if (pageData.pilotName || pageData.pilotCid) {
          message += '\n👨‍✈️ 机组信息:\n'
          message += '─'.repeat(20) + '\n'
          if (pageData.pilotName) message += `姓名: ${pageData.pilotName}\n`
          if (pageData.pilotCid) message += `CID: ${pageData.pilotCid}\n`
          if (pageData.pilotRating) message += `等级: ${pageData.pilotRating}\n`
        }
        
        // 时间信息
        if (pageData.connectTime || pageData.flightTime) {
          message += '\n⏱️ 时间信息:\n'
          message += '─'.repeat(20) + '\n'
          if (pageData.connectTime) message += `连线时间: ${pageData.connectTime}\n`
          if (pageData.flightTime) message += `飞行时间: ${pageData.flightTime}\n`
        }
        
        // 网络信息
        if (pageData.network) {
          message += `\n🌐 网络: ${pageData.network}\n`
        }
        
        // 页面信息
        message += `\n🔗 页面: https://www.vatprc.net/flights/${validFlightId}`
        message += `\n\n💡 提示: 使用 vatprc.flightpage ${validFlightId} 查看完整截图`
        
        return message
        
      } catch (error: any) {
        ctx.logger.error(`获取航班信息失败: ${error.message}`)
        return `获取信息失败: ${error.message}`
      }
    })

  // 批量查询航班状态
  ctx.command('vatprc.batchflight <flightIds>', '批量查询航班状态')
    .action(async ({ session }, flightIds) => {
      if (!flightIds) {
        return '请输入航班ID列表，用空格分隔，例如: vatprc.batchflight CXA123 CSN456'
      }
      
      const flightList = flightIds.split(/\s+/)
        .map(id => id.toUpperCase().trim())
        .filter(id => /^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/.test(id))
      
      if (flightList.length === 0) {
        return '请输入有效的航班ID'
      }
      
      if (flightList.length > 5) {
        return '一次最多查询5个航班'
      }
      
      await session.send(`正在批量查询 ${flightList.length} 个航班的状态...`)
      
      const results = []
      
      for (const flightId of flightList) {
        try {
          const pageData = await screenshot.getFlightDataFromPage(flightId)
          
          results.push({
            flightId,
            success: !!pageData,
            data: pageData
          })
          
          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          results.push({
            flightId,
            success: false,
            error: error.message
          })
        }
      }
      
      // 生成结果报告
      let message = `📊 批量查询结果 (${results.length} 个航班):\n`
      message += '='.repeat(40) + '\n\n'
      
      results.forEach((result, index) => {
        message += `${index + 1}. ${result.flightId}: `
        
        if (result.success && result.data) {
          const data = result.data
          message += `✅ `
          if (data.status) message += `${data.status} | `
          if (data.departure && data.arrival) {
            message += `${data.departure}→${data.arrival} | `
          }
          if (data.pilotName) message += `👨‍✈️${data.pilotName}`
          
          // 详细信息命令
          message += `\n   详情: vatprc.flightinfo ${result.flightId}\n`
          
        } else {
          message += `❌ 查询失败`
          if (result.error) message += ` (${result.error})`
          message += '\n'
        }
        
        message += '\n'
      })
      
      return message
    })

  // Flight plan check screenshot
  ctx.command('vatprc.plancheck <callsign>', 'Plan check screenshot')
    .alias('vatprc.plancheck.cn')
    .action(async ({ session }, callsign) => {
      if (!callsign) {
        return 'Please provide a callsign, e.g. vatprc.plancheck CXA123'
      }

      const validCallsign = callsign.toUpperCase().trim()

      if (!/^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/.test(validCallsign)) {
        return 'Invalid callsign format, e.g. CXA123'
      }

      await session.send(`Checking flight plan for ${validCallsign}...`)
      ctx.logger.info(`plancheck start: ${validCallsign}`)

      try {
        const imageBuffer = await screenshot.getFlightScreenshot(validCallsign, {
          width: 1200,
          height: 800,
          quality: 85,
          delay: 2000,
          fullPage: true,
        })

        if (!imageBuffer) {
          ctx.logger.warn(`plancheck screenshot failed: ${validCallsign}`)
          return 'Failed to generate screenshot, please retry later'
        }

        const base64Image = imageBuffer.toString('base64')
        await session.send(h.image(`data:image/jpeg;base64,${base64Image}`))
        ctx.logger.info(`plancheck screenshot sent: ${validCallsign}`)
        return 'Plan check screenshot sent'
      } catch (error: any) {
        ctx.logger.error(`plancheck failed: ${error.message}`)
        return `Plan check failed: ${error.message}`
      }
    })
}
