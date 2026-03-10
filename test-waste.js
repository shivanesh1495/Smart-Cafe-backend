const mongoose = require('mongoose');
const { sustainabilityService } = require('./src/services');
const User = require('./src/models/User');

require('dotenv').config();

async function testWasteReportFlow() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Find a student
    const student = await User.findOne({ role: 'user' });
    if (!student) {
      console.log('No student found');
      process.exit(1);
    }
    console.log(`Testing with student: ${student.fullName} (${student._id})`);

    // Submit a waste report (High waste)
    console.log('Submitting waste report...');
    const reportData = {
      wasteAmount: 'All',
      reason: 'Poor quality',
      notes: 'Test note',
      mealType: 'LUNCH'
    };
    const report = await sustainabilityService.submitWasteReport(student._id, reportData);
    console.log('Report created:', report._id);

    // Fetch waste stats as a manager
    console.log('Fetching waste stats...');
    const stats = await sustainabilityService.getWasteStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));

    let found = false;
    for (const byAmount of stats.byWasteAmount) {
      if (byAmount._id === 'All' && byAmount.count > 0) {
        found = true;
      }
    }

    if (found) {
      console.log('SUCCESS: The report successfully went to the database and appears in the manager stats!');
    } else {
      console.log('ERROR: The report did not appear in the stats.');
    }

    // Cleanup
    console.log('Cleaning up...');
    await mongoose.model('WasteReport').findByIdAndDelete(report._id);
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

testWasteReportFlow();
