import React, { useState, useEffect } from 'react'
import { Clock, Users, Bell, Settings, Lock, Unlock, Eye, EyeOff } from 'lucide-react'
import PatientQueue from './PatientQueue'
import CurrentTime from './CurrentTime'
import DoctorSchedule from './DoctorStatus'
import PatientSummary from './PatientSummary'
import socketManager from '../utils/socket'

const HospitalBoard = () => {
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isPrivacyMode, setIsPrivacyMode] = useState(true)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [stats, setStats] = useState({})
  const [schedule, setSchedule] = useState({})
  const [error, setError] = useState(null)

  // 컴포넌트 마운트 시 데이터 로드 및 소켓 이벤트 설정
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 중앙 서버에서만 데이터 로드
        console.log('중앙 서버에서 데이터 로딩 중...');
        
        const [patientsData, doctorsData, statsData, scheduleData] = await Promise.all([
          socketManager.fetchPatients(),
          socketManager.fetchDoctors(),
          socketManager.fetchStats(),
          socketManager.fetchSchedule()
        ]);

        console.log('🌐 백엔드에서 받은 환자 데이터:', patientsData);
        console.log('로드된 의사 데이터:', doctorsData);
        
        if (patientsData && patientsData.length > 0) {
          // 담당의사와 시술명 필드 확인
          patientsData.forEach(patient => {
            console.log(`🌐 백엔드: 환자 ${patient.patient_name}: 시술명=${patient.assigned_doctor}, 담당의사=${patient.doctor}`);
          });
        }

        // 중앙 서버 데이터로만 설정
        setPatients(patientsData || []);
        setDoctors(doctorsData || []);
        setStats(statsData || {});
        
        // 스케줄 데이터 처리 (빈 객체면 기본 구조 생성)
        if (scheduleData && Object.keys(scheduleData).length > 0) {
          console.log('📅 백엔드에서 스케줄 데이터 수신:', scheduleData);
          setSchedule(scheduleData);
        } else {
          console.log('📅 백엔드 스케줄 데이터 없음, 기본 구조 생성');
          const defaultSchedule = {
            월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
            화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
            수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
            목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
            금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
          };
          setSchedule(defaultSchedule);
          
          // 기본 스케줄을 서버에 저장 (지연 실행으로 안전하게)
          setTimeout(() => {
            updateSchedule(defaultSchedule);
          }, 1000);
        }
        
        // API 데이터 로드 완료
        console.log('중앙 서버 데이터 로드 완료 (스케줄 포함)');
      } catch (error) {
        console.error('중앙 서버 데이터 로드 실패:', error);
        console.log('로컬 백업 데이터 확인 중...');
        
        // 백엔드 연결 실패 시 로컬 백업 데이터 사용
        try {
          const backupPatients = localStorage.getItem('hospitalPatients_backup');
          const backupDoctors = localStorage.getItem('hospitalDoctors_backup');
          const backupStats = localStorage.getItem('hospitalStats_backup');
          const backupSchedule = localStorage.getItem('hospitalSchedule_backup');
          
          if (backupPatients && backupPatients !== 'null') {
            const parsedPatients = JSON.parse(backupPatients);
            if (parsedPatients && parsedPatients.length > 0) {
              console.log('🔍 로컬 백업 환자 데이터 복원:', parsedPatients);
              
              // 담당의사와 시술명 필드 확인
              parsedPatients.forEach(patient => {
                console.log(`환자 ${patient.patient_name}: 시술명=${patient.assigned_doctor}, 담당의사=${patient.doctor}`);
              });
              
              setPatients(parsedPatients);
            } else {
              console.log('로컬 백업 환자 데이터가 비어있음');
              setPatients([]);
            }
          } else {
            console.log('로컬 백업 환자 데이터 없음');
            setPatients([]);
          }
          
          if (backupDoctors && backupDoctors !== 'null') {
            const parsedDoctors = JSON.parse(backupDoctors);
            if (parsedDoctors && parsedDoctors.length > 0) {
              console.log('로컬 백업 의사 데이터 복원:', parsedDoctors);
              setDoctors(parsedDoctors);
            } else {
              // 기본 의사 데이터 설정
              const defaultDoctors = [
                { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
                { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
                { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
              ];
              setDoctors(defaultDoctors);
            }
          } else {
            // 기본 의사 데이터 설정
            const defaultDoctors = [
              { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
              { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
              { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
            ];
            setDoctors(defaultDoctors);
          }
          
          if (backupStats && backupStats !== 'null') {
            const parsedStats = JSON.parse(backupStats);
            console.log('로컬 백업 통계 데이터 복원:', parsedStats);
            setStats(parsedStats);
          } else {
            setStats({ total_patients: 0, waiting_patients: 0, in_treatment: 0, completed_today: 0 });
          }

          if (backupSchedule && backupSchedule !== 'null') {
            const parsedSchedule = JSON.parse(backupSchedule);
            console.log('📅 로컬 백업 스케줄 데이터 복원:', parsedSchedule);
            setSchedule(parsedSchedule);
          } else {
            console.log('📅 로컬 백업 스케줄 데이터 없음, 기본 구조 생성');
            const defaultSchedule = {
              월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
              화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
              수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
              목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
              금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
            };
            setSchedule(defaultSchedule);
          }
          
          console.log('✅ 로컬 백업 데이터 복원 완료 (스케줄 포함)');
        } catch (backupError) {
          console.error('로컬 백업 데이터 복원 실패:', backupError);
          // 백업도 실패하면 기본 상태로 시작
          setPatients([]);
          const defaultDoctors = [
            { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
            { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
            { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
          ];
          setDoctors(defaultDoctors);
          setStats({ total_patients: 0, waiting_patients: 0, in_treatment: 0, completed_today: 0 });
          
          // 기본 스케줄 설정
          const defaultSchedule = {
            월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
            화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
            수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
            목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
            금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
          };
          setSchedule(defaultSchedule);
        }
        
        // 에러는 설정하지 않음 (로컬 백업으로 동작)
        // setError(error.message);
      }
    };

    // 실시간 이벤트 리스너 설정
    const setupSocketListeners = () => {
      // 환자 데이터 업데이트
      socketManager.on('patients_data', (data) => {
        console.log('실시간 환자 데이터 수신:', data);
        setPatients(data || []);
      });

      socketManager.on('patient_updated', (updatedPatient) => {
        console.log('🔄 환자 상태 업데이트:', updatedPatient);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === updatedPatient.id ? { ...patient, ...updatedPatient } : patient
          );
          console.log('✅ 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_added', (newPatient) => {
        console.log('🎯 새 환자 실시간 수신:', newPatient);
        
        // 중복 방지: 이미 존재하는 환자인지 확인
        setPatients(prev => {
          const exists = prev.some(patient => patient.id === newPatient.id);
          if (exists) {
            console.log('⚠️ 이미 존재하는 환자 - 추가 생략:', newPatient.id);
            return prev;
          }
          console.log('✅ 새 환자 추가됨:', newPatient);
          return [...prev, newPatient];
        });
      });

      socketManager.on('patient_deleted', (deletedPatient) => {
        console.log('🗑️ 환자 삭제 실시간 수신:', deletedPatient);
        setPatients(prev => prev.filter(patient => patient.id !== deletedPatient.id));
      });

      // 실시간 환자 정보 업데이트 수신
      socketManager.on('patient_name_updated', (data) => {
        console.log('🎯 환자 이름 실시간 업데이트 수신:', data);
        console.log('🔄 현재 환자 목록 업데이트 중...');
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, patient_name: data.newName } : patient
          );
          console.log('✅ 환자 목록 업데이트 완료:', updated);
          return updated;
        });
      });

      socketManager.on('patient_number_updated', (data) => {
        console.log('환자 번호 실시간 업데이트 수신:', data);
        setPatients(prev => prev.map(patient => 
          patient.id === data.patientId ? { ...patient, patient_id: data.newNumber } : patient
        ));
      });

      socketManager.on('patient_procedure_updated', (data) => {
        console.log('🏥 시술명 실시간 업데이트:', data);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, assigned_doctor: data.newProcedure, procedure: data.newProcedure } : patient
          );
          console.log('✅ 시술명 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_doctor_updated', (data) => {
        console.log('👨‍⚕️ 담당의사 실시간 업데이트:', data);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, doctor: data.newDoctor } : patient
          );
          console.log('✅ 담당의사 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_room_moved', (data) => {
        console.log('🏠 환자 방 이동 실시간 업데이트:', data);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, department: data.newRoom, room: data.newRoom } : patient
          );
          console.log('✅ 환자 방 이동 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      // 외래 진료 스케줄 실시간 업데이트
      socketManager.on('schedule_updated', (updatedSchedule) => {
        console.log('📅 스케줄 실시간 업데이트 수신:', updatedSchedule);
        setSchedule(updatedSchedule);
        console.log('✅ 스케줄 로컬 상태 업데이트 완료');
      });

      // 의사 데이터 업데이트
      socketManager.on('doctors_data', (data) => {
        setDoctors(data);
      });

      socketManager.on('doctor_updated', (updatedDoctor) => {
        setDoctors(prev => prev.map(doctor => 
          doctor.id === updatedDoctor.id ? { ...doctor, ...updatedDoctor } : doctor
        ));
      });

      // 통계 데이터 업데이트
      socketManager.on('stats_data', (data) => {
        setStats(data);
      });

      socketManager.on('stats_updated', (data) => {
        setStats(data);
      });

      // 클라이언트 활동 전송
      socketManager.on('connect', () => {
        socketManager.emit('client_activity', {
          type: 'page_load',
          timestamp: new Date(),
          userAgent: navigator.userAgent
        });
      });
    };

    loadInitialData();
    setupSocketListeners();

    return () => {
      // 컴포넌트 언마운트 시 리스너 제거
      socketManager.off('patients_data');
      socketManager.off('patient_updated');
      socketManager.off('patient_added');
      socketManager.off('patient_deleted');
      socketManager.off('patient_name_updated');
      socketManager.off('patient_number_updated');
      socketManager.off('patient_procedure_updated');
      socketManager.off('patient_doctor_updated');
      socketManager.off('patient_room_moved');
      socketManager.off('schedule_updated');
      socketManager.off('doctors_data');
      socketManager.off('doctor_updated');
      socketManager.off('stats_data');
      socketManager.off('stats_updated');
      socketManager.off('connect');
      socketManager.off('disconnect');
      socketManager.off('connect_error');
    };
  }, []);

  // 로컬 상태 관리 (백엔드 서버 연결 실패 시 대비)
  useEffect(() => {
    // 상태가 변경될 때마다 즉시 백업 (빈 배열은 저장하지 않음)
    if (patients && patients.length > 0) {
      localStorage.setItem('hospitalPatients_backup', JSON.stringify(patients));
      console.log('🔄 환자 데이터 실시간 백업:', patients.length, '명');
      
      // 담당의사와 시술명 필드 확인
      patients.forEach(patient => {
        console.log(`💾 백업: 환자 ${patient.patient_name}: 시술명=${patient.assigned_doctor}, 담당의사=${patient.doctor}`);
      });
    }
  }, [patients]);

  useEffect(() => {
    if (doctors && doctors.length > 0) {
      localStorage.setItem('hospitalDoctors_backup', JSON.stringify(doctors));
    }
  }, [doctors]);

  useEffect(() => {
    if (stats && Object.keys(stats).length > 0) {
      localStorage.setItem('hospitalStats_backup', JSON.stringify(stats));
    }
  }, [stats]);

  useEffect(() => {
    if (schedule && Object.keys(schedule).length > 0) {
      localStorage.setItem('hospitalSchedule_backup', JSON.stringify(schedule));
      console.log('📅 스케줄 데이터 실시간 백업 완료');
    }
  }, [schedule]);

  useEffect(() => {
    // 페이지 언로드 시 최종 백업
    const handleBeforeUnload = () => {
      if (patients && patients.length > 0) {
        localStorage.setItem('hospitalPatients_backup', JSON.stringify(patients));
        console.log('📤 페이지 종료 시 환자 데이터 백업:', patients.length, '명');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [patients]);

  // 환자 정보 업데이트 함수들 (실시간 동기화)
  const updatePatientName = async (patientId, newName) => {
    try {
      console.log('🔥 환자 이름 업데이트 시작:', patientId, newName);
      
      // 즉시 로컬 상태 업데이트
    setPatients(prevPatients =>
      prevPatients.map(patient =>
          patient.id === patientId ? { ...patient, patient_name: newName } : patient
        )
      );
      
      // 서버에 실시간 업데이트 (관리자 액션으로 전송)
      const updateData = {
        type: 'update_patient_name',
        patientId,
        newName,
        timestamp: new Date()
      };
      
      console.log('🚀 서버로 전송할 데이터:', updateData);
      socketManager.emit('admin_action', updateData);
      
      // 추가: 직접 다른 클라이언트에게도 전송
      socketManager.emit('patient_name_updated', {
        patientId,
        newName
      });
      
    } catch (error) {
      console.error('환자 이름 업데이트 실패:', error);
    }
  };

    const updatePatientNumber = async (patientId, newNumber) => {
    try {
      console.log('환자 번호 업데이트:', patientId, newNumber);
      
      // 즉시 로컬 상태 업데이트
    setPatients(prevPatients =>
      prevPatients.map(patient =>
          patient.id === patientId ? { ...patient, patient_id: newNumber } : patient
        )
      );
      
      // 서버에 실시간 업데이트
      socketManager.emit('admin_action', {
        type: 'update_patient_number',
        patientId,
        newNumber,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('환자 번호 업데이트 실패:', error);
    }
  };

    const updatePatientProcedure = async (patientId, newProcedure) => {
    try {
      console.log('🏥 시술명 업데이트 시작:', patientId, newProcedure);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`📝 환자 ${patient.patient_name} 시술명 변경: ${patient.assigned_doctor} → ${newProcedure}`);
            return { ...patient, assigned_doctor: newProcedure, procedure: newProcedure };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 시술명 업데이트 완료');
        return updated;
      });
      
      // 서버에 실시간 업데이트
      console.log('📤 서버로 시술명 업데이트 전송:', {
        type: 'update_patient_procedure',
        patientId,
        newProcedure,
        timestamp: new Date()
      });
      
      socketManager.emit('admin_action', {
        type: 'update_patient_procedure',
        patientId,
        newProcedure,
        timestamp: new Date()
      });
      
      console.log('🚀 시술명 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 시술명 업데이트 실패:', error);
    }
  };

    const updatePatientDoctor = async (patientId, newDoctor) => {
    try {
      console.log('👨‍⚕️ 담당의사 업데이트 시작:', patientId, newDoctor);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`📝 환자 ${patient.patient_name} 담당의사 변경: ${patient.doctor} → ${newDoctor}`);
            return { ...patient, doctor: newDoctor };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 담당의사 업데이트 완료');
        return updated;
      });
      
      // 서버에 실시간 업데이트
      console.log('📤 서버로 담당의사 업데이트 전송:', {
        type: 'update_patient_doctor',
        patientId,
        newDoctor,
        timestamp: new Date()
      });
      
      socketManager.emit('admin_action', {
        type: 'update_patient_doctor',
        patientId,
        newDoctor,
        timestamp: new Date()
      });
      
      console.log('🚀 담당의사 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 담당의사 업데이트 실패:', error);
    }
  };

  const updatePatientStatus = async (patientId, newStatus, assignedDoctor = null) => {
    try {
      console.log('🔄 환자 상태 업데이트:', patientId, newStatus, assignedDoctor);
      
      // 즉시 로컬 상태 업데이트 (백엔드 서버가 없어도 작동)
      setPatients(prev => {
        const updated = prev.map(patient => {
          if (patient.id === patientId) {
            const updatedPatient = { 
              ...patient, 
              status: newStatus, 
              assigned_doctor: assignedDoctor || patient.assigned_doctor 
            };
            
            // 시술중으로 변경될 때 대기시간을 0분으로 즉시 설정
            if (newStatus === 'procedure') {
              console.log('🕐 시술중 상태로 변경 - 대기시간 0분으로 초기화');
              updatedPatient.wait_time = 0;
              updatedPatient.waitTime = 0; // 호환성을 위해 둘 다 설정
            } else if (newStatus === 'waiting') {
              console.log('⏸️ 대기중 상태로 변경 - 대기시간 초기화');
              updatedPatient.wait_time = 0;
              updatedPatient.waitTime = 0;
            }
            
            return updatedPatient;
          }
          return patient;
        });
        
        // 백업은 useEffect에서 자동으로 처리됨
        
        return updated;
      });
      
      // 서버에 상태 업데이트 요청 (실시간 동기화)
      try {
        await socketManager.updatePatientStatus(patientId, newStatus, assignedDoctor);
        console.log('✅ 서버 업데이트 성공');
      } catch (serverError) {
        console.warn('⚠️ 서버 업데이트 실패 (로컬만 업데이트됨):', serverError);
      }
    } catch (error) {
      console.error('환자 상태 업데이트 실패:', error);
    }
  };

  // 환자 추가 (로컬 즉시 추가 + 서버 동기화)
  const addPatient = async (patientData) => {
    try {
      console.log('🆕 환자 추가 시작:', patientData);
      
      const newPatientData = {
        patient_name: patientData.name,
        patient_id: patientData.number,
        department: patientData.room,
        assigned_doctor: patientData.procedure, // 시술명을 assigned_doctor로 저장
        doctor: patientData.doctor, // 담당의사
        priority: patientData.priority || 1
      };
      
      // 임시 ID로 즉시 로컬에 추가 (백엔드 서버가 없어도 작동)
      const tempPatient = {
        id: Date.now(), // 임시 ID
        patient_name: newPatientData.patient_name,
        patient_id: newPatientData.patient_id,
        department: newPatientData.department,
        assigned_doctor: newPatientData.assigned_doctor, // 시술명 저장
        doctor: newPatientData.doctor, // 담당의사 저장
        priority: newPatientData.priority,
        status: 'waiting',
        wait_time: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log(`🆕 새 환자 생성: ${tempPatient.patient_name}, 시술명=${tempPatient.assigned_doctor}, 담당의사=${tempPatient.doctor}`);
      
      setPatients(prev => {
        const updated = [...prev, tempPatient];
        console.log('✅ 로컬에 환자 추가:', tempPatient);
        
        // 백업은 useEffect에서 자동으로 처리됨
        
        return updated;
      });
      
      console.log('📤 서버로 전송할 환자 데이터:', newPatientData);
      
      // 서버에 새 환자 추가 요청
      try {
        await socketManager.addPatient(newPatientData);
        console.log('✅ 서버 추가 성공');
      } catch (serverError) {
        console.warn('⚠️ 서버 추가 실패 (로컬만 추가됨):', serverError);
      }
    } catch (error) {
      console.error('환자 추가 실패:', error);
    }
  };

  // 외래 진료 스케줄 업데이트
  const updateSchedule = async (newSchedule) => {
    try {
      console.log('🔥 HospitalBoard - 스케줄 업데이트 시작:', newSchedule);
      
      // 즉시 로컬 상태 업데이트
      setSchedule(newSchedule);
      console.log('✅ HospitalBoard - 로컬 스케줄 업데이트 완료');
      
      // 서버에 스케줄 업데이트 전송
      console.log('🌐 HospitalBoard - 서버 API 호출 시작');
      const result = await socketManager.updateSchedule(newSchedule);
      console.log('🚀 HospitalBoard - 스케줄 서버 업데이트 완료:', result);
      
      // 추가: 직접 Socket.IO로 다른 클라이언트에게 전송
      socketManager.emit('schedule_broadcast', {
        type: 'schedule_update',
        schedule: newSchedule,
        timestamp: new Date()
      });
      console.log('📡 HospitalBoard - Socket.IO 브로드캐스트 전송 완료');
      
    } catch (error) {
      console.error('❌ HospitalBoard - 스케줄 업데이트 실패:', error);
    }
  };

  // 환자 방 이동 (드래그 앤 드롭)
  const movePatientToRoom = async (patientId, newRoom) => {
    try {
      console.log('🏠 환자 방 이동:', patientId, '→', newRoom);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`🔄 환자 ${patient.patient_name} 방 이동: ${patient.department} → ${newRoom}`);
            return { ...patient, department: newRoom, room: newRoom };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 방 이동 완료');
        return updated;
      });
      
      // 서버에 방 이동 업데이트 전송
      console.log('📤 서버로 방 이동 업데이트 전송:', {
        type: 'move_patient_room',
        patientId,
        newRoom,
        timestamp: new Date()
      });
      
      socketManager.emit('admin_action', {
        type: 'move_patient_room',
        patientId,
        newRoom,
        timestamp: new Date()
      });
      
      console.log('🚀 방 이동 서버 전송 완료');
    } catch (error) {
      console.error('❌ 환자 방 이동 실패:', error);
    }
  };

  // 환자 삭제 (로컬 즉시 삭제 + 서버 동기화 + 백업 업데이트)
  const deletePatient = async (patientId) => {
    try {
      console.log('🗑️ 환자 삭제 시작:', patientId);
      
      // 즉시 로컬 상태에서 삭제 (백엔드 서버가 없어도 작동)
      setPatients(prev => {
        const filtered = prev.filter(patient => patient.id !== patientId);
        console.log('✅ 로컬에서 환자 삭제 완료:', patientId);
        
        // 백업은 useEffect에서 자동으로 처리됨 (삭제된 상태도 유지)
        
        return filtered;
      });
      
      // 서버에 삭제 요청 (실시간 동기화)
      try {
        await socketManager.deletePatient(patientId);
        console.log('✅ 서버 삭제 성공');
      } catch (serverError) {
        console.warn('⚠️ 서버 삭제 실패 (로컬 백업으로 유지):', serverError);
      }
    } catch (error) {
      console.error('환자 삭제 실패:', error);
    }
  };

  // 의사 상태 업데이트 (실시간 동기화)
  const updateDoctorStatus = async (doctorId, status, currentPatient = null) => {
    try {
      console.log('의사 상태 업데이트:', doctorId, status, currentPatient);
      
      // 즉시 로컬 상태 업데이트
      setDoctors(prevDoctors =>
        prevDoctors.map(doctor =>
          doctor.id === doctorId ? { ...doctor, status, current_patient: currentPatient } : doctor
        )
      );
      
      // 서버에 실시간 업데이트
      await socketManager.updateDoctorStatus(doctorId, status, currentPatient);
    } catch (error) {
      console.error('의사 상태 업데이트 실패:', error);
    }
  };



  // 에러 발생 시 에러 화면 표시
  if (error) {
    return (
      <div className="min-h-screen p-3 md:p-6 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-8 rounded-xl max-w-md">
          <h2 className="text-2xl font-bold mb-4">❌ 연결 오류</h2>
          <p className="mb-4">백엔드 서버 연결에 실패했습니다:</p>
          <p className="text-sm bg-red-800/50 p-3 rounded">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-6">
      <div className="max-w-full mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center mb-8 relative">
          {/* 버튼들 */}
          <div className="absolute top-0 right-0 flex gap-2">
            {/* 개인정보 보호 토글 버튼 */}
            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${isPrivacyMode 
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30' 
                  : 'bg-orange-600/20 border-orange-500 text-orange-300 hover:bg-orange-600/30'
                }
                border-2 backdrop-blur-md
              `}
              title={isPrivacyMode ? "개인정보 표시" : "개인정보 숨김"}
            >
              {isPrivacyMode ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
            
            {/* 관리자 모드 토글 버튼 */}
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${isAdminMode 
                  ? 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/30' 
                  : 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30'
                }
                border-2 backdrop-blur-md
              `}
              title={isAdminMode ? "관리자 모드 종료" : "관리자 모드 시작"}
            >
              {isAdminMode ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              심장뇌혈관 시술센터 전광판
            </h1>
          </div>
          
          <CurrentTime />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-8">
          {/* 메인 영역 - Angio방들 */}
          <div className="xl:col-span-8 space-y-6">
            {/* Angio방들 3열 배치 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Angio 1R */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => p.department === 'Angio 1R' || p.room === 'Angio 1R')} 
                  roomTitle="Angio 1R"
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                />
              </div>

              {/* Angio 2R */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => p.department === 'Angio 2R' || p.room === 'Angio 2R')} 
                  roomTitle="Angio 2R"
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                />
              </div>

              {/* Hybrid room */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => p.department === 'Hybrid Room' || p.room === 'Hybrid Room' || p.department === 'Hybrid Room' || p.room === 'Hybrid Room')} 
                  roomTitle="Hybrid Room"
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                />
              </div>
            </div>

            {/* 외래 진료일정 */}
            <div>
              <DoctorSchedule 
                isAdminMode={isAdminMode} 
                doctors={doctors}
                schedule={schedule}
                onUpdateDoctorStatus={updateDoctorStatus}
                onUpdateSchedule={updateSchedule}
              />
            </div>
          </div>

          {/* 사이드바 - 환자 요약 */}
          <div className="xl:col-span-2">
            <PatientSummary patients={patients} isPrivacyMode={isPrivacyMode} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HospitalBoard
