import serial
import time

# Based on your last screenshot, your Arduino is on COM11
SERIAL_PORT = 'COM11' 
BAUD_RATE = 9600

try:
    print(f"Connecting to DyslexiScan Pen on {SERIAL_PORT}...")
    # Open the connection to the USB cable
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    time.sleep(2) # Give the Arduino a second to wake up
    print("Connected! Squeeze the pen...\n")

    while True:
        # If there is data waiting in the USB cable, read it!
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8').strip()
            
            # Split the "50,0" into two separate variables
            parts = line.split(',')
            if len(parts) == 2:
                grip1 = parts[0]
                grip2 = parts[1]
                
                # Print it in the Python terminal!
                print(f"Python Live Data -> Grip 1: {grip1}% | Grip 2: {grip2}%")

except serial.SerialException:
    print(f"Error: Could not connect to {SERIAL_PORT}. Is the Serial Monitor still open in Arduino?")
except KeyboardInterrupt:
    print("\nClosing connection.")
    ser.close()