import { QProcessManager } from './process-manager.js';

async function testQProcessManager() {
  const manager = new QProcessManager();

  try {
    console.log('Testing Q Process Manager...\n');

    // Test spawning a process
    console.log('1. Spawning a Q process...');
    const processInfo = await manager.spawnQProcess({
      task: 'Hello! Can you tell me what the current date is?',
      timeout: 60,
    });
    console.log(`Process spawned: ${processInfo.id}`);
    console.log(`Status: ${processInfo.status}\n`);

    // Wait a moment for the process to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test listing processes
    console.log('2. Listing processes...');
    const processes = manager.listProcesses();
    console.log(`Found ${processes.length} processes:`);
    processes.forEach(p => {
      console.log(`  - ${p.id}: ${p.status} (${p.task.substring(0, 50)}...)`);
    });
    console.log();

    // Wait for some output
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test getting output
    console.log('3. Getting process output...');
    const output = await manager.getProcessOutput(processInfo.id);
    console.log(`Output:\n${output}\n`);

    // Test sending additional input
    console.log('4. Sending additional input...');
    const sent = await manager.sendToProcess(processInfo.id, 'Thank you! Can you also tell me what day of the week it is?');
    console.log(`Input sent: ${sent}\n`);

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get updated output
    console.log('5. Getting updated output...');
    const updatedOutput = await manager.getProcessOutput(processInfo.id);
    console.log(`Updated output:\n${updatedOutput}\n`);

    // Test terminating the process
    console.log('6. Terminating process...');
    const terminated = await manager.terminateProcess(processInfo.id);
    console.log(`Process terminated: ${terminated}\n`);

    // Test cleanup
    console.log('7. Cleaning up finished processes...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for termination
    const cleaned = manager.cleanupFinishedProcesses();
    console.log(`Cleaned up ${cleaned} processes\n`);

    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await manager.cleanup();
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testQProcessManager();
}
