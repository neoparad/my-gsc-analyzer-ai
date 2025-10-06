import { inngest } from '../client.js'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

export const directoryAnalysis = inngest.createFunction(
  {
    id: 'directory-analysis',
    name: 'Directory Analysis'
  },
  { event: 'gsc/directory.analyze' },
  async ({ event, step }) => {
    const { siteUrl, startMonth, endMonth, directories, viewMode, searchType, showOthers } = event.data

    console.log('Inngest: Directory Analysis started', { siteUrl, directories, viewMode, searchType })

    // 認証情報を読み込み
    const credentials = await step.run('load-credentials', async () => {
      const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
      return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    })

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // 期間の計算
    const periods = await step.run('calculate-periods', async () => {
      const start = new Date(startMonth + '-01')
      const end = new Date(endMonth + '-01')
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)

      const periodsArray = []

      if (viewMode === 'monthly') {
        let current = new Date(start)
        while (current <= end) {
          const year = current.getFullYear()
          const month = current.getMonth() + 1
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`
          const lastDay = new Date(year, month, 0).getDate()
          const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

          periodsArray.push({
            label: `${year}年${month}月`,
            startDate,
            endDate
          })

          current.setMonth(current.getMonth() + 1)
        }
      } else {
        const startYear = start.getFullYear()
        const endYear = end.getFullYear()
        const startQ = Math.floor(start.getMonth() / 3) + 1
        const endQ = Math.floor(end.getMonth() / 3) + 1

        for (let year = startYear; year <= endYear; year++) {
          const qStart = year === startYear ? startQ : 1
          const qEnd = year === endYear ? endQ : 4

          for (let q = qStart; q <= qEnd; q++) {
            const qStartMonth = (q - 1) * 3 + 1
            const qEndMonth = q * 3
            const startDate = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
            const endDay = new Date(year, qEndMonth, 0).getDate()
            const endDate = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

            periodsArray.push({
              label: `${year}年Q${q}`,
              startDate,
              endDate
            })
          }
        }
      }

      return periodsArray
    })

    const chartData = []
    const tableData = []

    // 検索タイプのマッピング
    const searchTypeMap = {
      'web': 'web',
      'image': 'image',
      'video': 'video',
      'news': 'news'
    }
    const apiSearchType = searchTypeMap[searchType] || 'web'

    // 各期間のデータを並列で取得
    for (const period of periods) {
      const periodData = await step.run(`fetch-period-${period.label}`, async () => {
        const periodChartData = { period: period.label }

        // 各ディレクトリのデータを並列で取得
        const fetchTasks = directories.map(async (dir) => {
          try {
            const dimensionFilterGroups = [{
              filters: [{
                dimension: 'page',
                operator: 'contains',
                expression: dir
              }]
            }]

            const [pageResponse, queryResponse] = await Promise.all([
              searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                  startDate: period.startDate,
                  endDate: period.endDate,
                  dimensions: ['page'],
                  dimensionFilterGroups,
                  type: apiSearchType,
                  rowLimit: 25000,
                  dataState: 'final'
                }
              }),
              searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                  startDate: period.startDate,
                  endDate: period.endDate,
                  dimensions: ['query'],
                  dimensionFilterGroups,
                  type: apiSearchType,
                  rowLimit: 25000,
                  dataState: 'final'
                }
              })
            ])

            const pageRows = pageResponse.data?.rows || []
            const queryRows = queryResponse.data?.rows || []

            const clicks = pageRows.reduce((sum, row) => sum + (row.clicks || 0), 0)
            const impressions = pageRows.reduce((sum, row) => sum + (row.impressions || 0), 0)
            const avgPosition = pageRows.length > 0
              ? pageRows.reduce((sum, row) => sum + (row.position || 0), 0) / pageRows.length
              : 0
            const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00'
            const queryCount = queryRows.length

            return {
              period: period.label,
              directory: dir,
              clicks,
              impressions,
              ctr,
              position: avgPosition.toFixed(1),
              queryCount,
              chartClicks: clicks
            }
          } catch (error) {
            console.error(`Error fetching data for ${dir}:`, error.message)
            return null
          }
        })

        // その他ページのデータ
        if (showOthers) {
          fetchTasks.push((async () => {
            try {
              const [pageResponse, queryResponse] = await Promise.all([
                searchconsole.searchanalytics.query({
                  siteUrl,
                  requestBody: {
                    startDate: period.startDate,
                    endDate: period.endDate,
                    dimensions: ['page'],
                    type: apiSearchType,
                    rowLimit: 25000,
                    dataState: 'final'
                  }
                }),
                searchconsole.searchanalytics.query({
                  siteUrl,
                  requestBody: {
                    startDate: period.startDate,
                    endDate: period.endDate,
                    dimensions: ['query'],
                    type: apiSearchType,
                    rowLimit: 25000,
                    dataState: 'final'
                  }
                })
              ])

              const allPageRows = pageResponse.data?.rows || []
              const allQueryRows = queryResponse.data?.rows || []

              const otherPageRows = allPageRows.filter(row => {
                const url = row.keys[0]
                return !directories.some(dir => url.includes(dir))
              })

              const clicks = otherPageRows.reduce((sum, row) => sum + (row.clicks || 0), 0)
              const impressions = otherPageRows.reduce((sum, row) => sum + (row.impressions || 0), 0)
              const avgPosition = otherPageRows.length > 0
                ? otherPageRows.reduce((sum, row) => sum + (row.position || 0), 0) / otherPageRows.length
                : 0
              const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00'

              const dirQueryCount = 0 // 簡略化のため0とする
              const queryCount = Math.max(0, allQueryRows.length - dirQueryCount)

              return {
                period: period.label,
                directory: 'その他',
                clicks,
                impressions,
                ctr,
                position: avgPosition.toFixed(1),
                queryCount,
                chartClicks: clicks
              }
            } catch (error) {
              console.error('Error fetching data for others:', error.message)
              return null
            }
          })())
        }

        const results = await Promise.all(fetchTasks)

        results.forEach(result => {
          if (result) {
            periodChartData[result.directory] = result.chartClicks
          }
        })

        return {
          periodChartData,
          periodTableData: results.filter(r => r !== null)
        }
      })

      chartData.push(periodData.periodChartData)
      tableData.push(...periodData.periodTableData)
    }

    return { chartData, tableData }
  }
)
