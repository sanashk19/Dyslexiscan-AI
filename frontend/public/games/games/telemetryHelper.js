/**
 * Telemetry Helper Utility
 * Games use this to send performance data to the monitoring system
 */

export class TelemetrySession {
  constructor(gameName, childId) {
    this.gameName = gameName
    this.childId = childId
    this.sessionId = Date.now()
    this.events = []
    this.startTime = Date.now()
  }

  trackWord(word, totalDuration, errorCount = 0) {
    this.events.push({
      word,
      totalDuration,
      errorCount,
      timestamp: Date.now() - this.startTime
    })
  }

  trackMultiple(eventsData) {
    eventsData.forEach(evt => {
      this.trackWord(evt.word, evt.totalDuration, evt.errorCount || 0)
    })
  }

  getPayload() {
    return {
      childId: this.childId,
      game: this.gameName,
      sessionId: this.sessionId,
      events: this.events,
      duration: Date.now() - this.startTime
    }
  }

  async submit() {
    try {
      const payload = this.getPayload()
      
      const response = await fetch('http://localhost:5000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()

      // Emit event for dashboard to listen
      window.dispatchEvent(new CustomEvent('telemetry-update', {
        detail: {
          sessionId: this.sessionId,
          game: this.gameName,
          childId: this.childId,
          analysis: result.analysis,
          profile: result.childProfile
        }
      }))

      return result
    } catch (error) {
      console.error('Telemetry submission failed:', error)
      throw error
    }
  }

  reset() {
    this.events = []
    this.sessionId = Date.now()
    this.startTime = Date.now()
  }
}

export async function submitGameTelemetry(gameName, childId, eventsData) {
  const session = new TelemetrySession(gameName, childId)
  session.trackMultiple(eventsData)
  return await session.submit()
}
