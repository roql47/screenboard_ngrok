import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

const CurrentTime = ({ isDarkMode }) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  return (
    <div className={`flex items-center justify-center gap-4 transition-colors duration-300 ${
      isDarkMode ? 'text-white' : 'text-black'
    }`}>
      <Clock className="w-8 h-8 text-blue-400" />
      <div className="text-center">
        <div className="text-4xl font-bold digital-font mb-1">
          {formatTime(currentTime)}
        </div>
        <div className="text-xl opacity-80">
          {formatDate(currentTime)}
        </div>
      </div>
    </div>
  )
}

export default CurrentTime

