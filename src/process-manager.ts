import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export interface QProcessInfo {
  id: string;
  pid?: number;
  status: 'starting' | 'running' | 'finished' | 'error' | 'terminated';
  task: string;
  startTime: Date;
  endTime?: Date;
  workingDirectory?: string;
  timeout: number;
  profile?: string;
}

export interface QProcessData extends QProcessInfo {
  process?: ChildProcess;
  output: string[];
  errorOutput: string[];
  timeoutHandle?: NodeJS.Timeout;
}

export interface SpawnQProcessOptions {
  task: string;
  processId?: string;
  timeout?: number;
  workingDirectory?: string;
  profile?: string;
}

export class QProcessManager {
  private processes: Map<string, QProcessData> = new Map();

  async spawnQProcess(options: SpawnQProcessOptions): Promise<QProcessInfo> {
    const {
      task,
      processId = uuidv4(),
      timeout = 300,
      workingDirectory = process.cwd(),
      profile,
    } = options;

    // Check if process ID already exists
    if (this.processes.has(processId)) {
      throw new Error(`Process with ID ${processId} already exists`);
    }

    const processData: QProcessData = {
      id: processId,
      status: 'starting',
      task,
      startTime: new Date(),
      workingDirectory,
      timeout,
      profile,
      output: [],
      errorOutput: [],
    };

    this.processes.set(processId, processData);

    try {
      // Build Q command arguments
      const qArgs = ['chat'];
      if (profile) {
        qArgs.push('--profile', profile);
      }

      // Spawn the Q process
      const qProcess = spawn('q', qArgs, {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      processData.process = qProcess;
      processData.pid = qProcess.pid;
      processData.status = 'running';

      // Set up output handlers
      qProcess.stdout?.on('data', (data) => {
        processData.output.push(data.toString());
      });

      qProcess.stderr?.on('data', (data) => {
        processData.errorOutput.push(data.toString());
      });

      // Handle process exit
      qProcess.on('exit', (code, signal) => {
        processData.endTime = new Date();
        if (signal) {
          processData.status = 'terminated';
        } else if (code === 0) {
          processData.status = 'finished';
        } else {
          processData.status = 'error';
        }
        
        // Clear timeout if set
        if (processData.timeoutHandle) {
          clearTimeout(processData.timeoutHandle);
        }
      });

      qProcess.on('error', (error) => {
        processData.status = 'error';
        processData.errorOutput.push(`Process error: ${error.message}`);
        processData.endTime = new Date();
      });

      // Set up timeout
      if (timeout > 0) {
        processData.timeoutHandle = setTimeout(() => {
          if (processData.status === 'running') {
            this.terminateProcess(processId);
            processData.errorOutput.push(`Process timed out after ${timeout} seconds`);
          }
        }, timeout * 1000);
      }

      // Send the initial task to the Q process
      await this.sendToProcess(processId, task);

      return {
        id: processData.id,
        pid: processData.pid,
        status: processData.status,
        task: processData.task,
        startTime: processData.startTime,
        workingDirectory: processData.workingDirectory,
        timeout: processData.timeout,
      };
    } catch (error) {
      processData.status = 'error';
      processData.endTime = new Date();
      processData.errorOutput.push(`Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`);
      
      throw new Error(`Failed to spawn Q process: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  listProcesses(): QProcessInfo[] {
    return Array.from(this.processes.values()).map(p => ({
      id: p.id,
      pid: p.pid,
      status: p.status,
      task: p.task,
      startTime: p.startTime,
      endTime: p.endTime,
      workingDirectory: p.workingDirectory,
      timeout: p.timeout,
    }));
  }

  async getProcessOutput(processId: string): Promise<string> {
    const processData = this.processes.get(processId);
    if (!processData) {
      throw new Error(`Process ${processId} not found`);
    }

    const output = processData.output.join('');
    const errorOutput = processData.errorOutput.join('');
    
    let result = '';
    if (output) {
      result += `STDOUT:\n${output}\n`;
    }
    if (errorOutput) {
      result += `STDERR:\n${errorOutput}\n`;
    }
    if (!output && !errorOutput) {
      result = 'No output available yet.';
    }

    return result;
  }

  async terminateProcess(processId: string): Promise<boolean> {
    const processData = this.processes.get(processId);
    if (!processData || !processData.process) {
      return false;
    }

    if (processData.status === 'running') {
      processData.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (processData.process && !processData.process.killed) {
          processData.process.kill('SIGKILL');
        }
      }, 5000);

      return true;
    }

    return false;
  }

  async sendToProcess(processId: string, input: string): Promise<boolean> {
    const processData = this.processes.get(processId);
    if (!processData || !processData.process || processData.status !== 'running') {
      return false;
    }

    try {
      processData.process.stdin?.write(input + '\n');
      return true;
    } catch (error) {
      processData.errorOutput.push(`Failed to send input: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  cleanupFinishedProcesses(): number {
    let cleaned = 0;
    for (const [id, processData] of this.processes.entries()) {
      if (processData.status === 'finished' || processData.status === 'error' || processData.status === 'terminated') {
        // Clear timeout if still set
        if (processData.timeoutHandle) {
          clearTimeout(processData.timeoutHandle);
        }
        this.processes.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  async cleanup(): Promise<void> {
    // Terminate all running processes
    const terminationPromises = Array.from(this.processes.values())
      .filter(p => p.status === 'running')
      .map(p => this.terminateProcess(p.id));

    await Promise.all(terminationPromises);

    // Clear all timeouts
    for (const processData of this.processes.values()) {
      if (processData.timeoutHandle) {
        clearTimeout(processData.timeoutHandle);
      }
    }

    this.processes.clear();
  }

  getProcessInfo(processId: string): QProcessInfo | null {
    const processData = this.processes.get(processId);
    if (!processData) {
      return null;
    }

    return {
      id: processData.id,
      pid: processData.pid,
      status: processData.status,
      task: processData.task,
      startTime: processData.startTime,
      endTime: processData.endTime,
      workingDirectory: processData.workingDirectory,
      timeout: processData.timeout,
    };
  }
}
