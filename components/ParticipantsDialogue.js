import { Button } from "./ui/button";
import supabase from "../utils/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState, useEffect } from "react";
import { Textarea } from "./ui/textarea";
import Link from "next/link";
import Papa from 'papaparse';

const ParticipantsDialogue = ({roomId}) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [org, setOrg] = useState("");
  const [msg, setMsg] = useState(null);
  const [desc, setDesc] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isPublicRoom, setIsPublicRoom] = useState(false);

  useEffect(() => {
    const fetchRoomType = async () => {
      const { data, error } = await supabase
        .from("Rooms")
        .select("type")
        .eq("uuid", roomId)
        .single();
      
      if (!error && data) {
        setIsPublicRoom(data.type === 'public');
      }
    };

    fetchRoomType();
  }, [roomId]);

  const clear = () => {
    setName("");
    setEmail("");
    setPhotoUrl("");
    setPhone("");
    setOrg("");
    setDesc("");
  };

  const checkExistingParticipant = async (email, name) => {
    if (isPublicRoom) {
      const { data: existingName } = await supabase
        .from("Profiles")
        .select("name")
        .eq("name", name)
        .eq("roomid", roomId)
        .single();

      if (existingName) {
        return "Name already exists in this room";
      }
    } else {
      const { data: existingEmail } = await supabase
        .from("Profiles")
        .select("email")
        .eq("email", email)
        .eq("roomid", roomId)
        .single();

      const { data: existingName } = await supabase
        .from("Profiles")
        .select("name")
        .eq("name", name)
        .eq("roomid", roomId)
        .single();

      if (existingEmail) {
        return "Email already exists in this room";
      }
      if (existingName) {
        return "Name already exists in this room";
      }
    }
    return null;
  };

  const validateParticipant = (participant) => {
    // Clean and normalize field names
    const normalizedParticipant = {};
    Object.keys(participant).forEach(key => {
      const normalizedKey = key.trim().toLowerCase();
      normalizedParticipant[normalizedKey] = participant[key]?.trim() || '';
    });

    // Required fields validation
    const requiredFields = isPublicRoom ? ['name'] : ['name', 'email'];
    const missingFields = requiredFields.filter(field => !normalizedParticipant[field]);
    
    if (missingFields.length > 0) {
      return `Missing required fields: ${missingFields.join(', ')}`;
    }
    
    // Email validation (only for non-public rooms)
    if (!isPublicRoom && normalizedParticipant.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedParticipant.email)) {
        return 'Invalid email format';
      }
    }

    // Name validation (at least 2 characters, only letters, spaces, and hyphens)
    if (!/^[A-Za-z\s-]{2,}$/.test(normalizedParticipant.name)) {
      return 'Name must be at least 2 characters and contain only letters, spaces, and hyphens';
    }

    // Phone validation (optional but if provided must be valid)
    if (normalizedParticipant.phone && !/^[\d\s()+.-]{10,}$/.test(normalizedParticipant.phone)) {
      return 'Invalid phone number format';
    }

    // URL validation (optional but if provided must be valid)
    if (normalizedParticipant.photourl) {
      try {
        new URL(normalizedParticipant.photourl);
      } catch {
        return 'Invalid photo URL format';
      }
    }

    return null;
  };

  const handleBulkUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx'].includes(fileType)) {
      setMsg("Please upload a CSV or Excel file");
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    setBulkFile(file);
  };

  const processBulkUpload = async () => {
    if (!bulkFile) {
      setMsg("Please select a file first");
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    setBulkLoading(true);
    setMsg(null);

    try {
      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(bulkFile);
      });

      // Parse CSV with header transformations
      const { data } = Papa.parse(fileContent, { 
        header: true,
        transformHeader: (header) => header.trim().toLowerCase()
      });

      // Track statistics
      const stats = {
        total: data.length,
        added: 0,
        skipped: {
          validation: 0,
          duplicate: 0
        }
      };

      // Validate and prepare participants
      const participants = [];
      const errors = [];
      const processedNames = new Set();
      const processedEmails = new Set();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const validationError = validateParticipant(row);
        
        if (validationError) {
          errors.push(`Row ${i + 2}: ${validationError}`);
          stats.skipped.validation++;
          continue;
        }

        const name = row.name.trim();
        const email = row.email?.toLowerCase().trim() || '';
        
        // Check for duplicates within the CSV file
        if (isPublicRoom) {
          if (processedNames.has(name)) {
            stats.skipped.duplicate++;
            continue;
          }
        } else {
          if (processedEmails.has(email)) {
            stats.skipped.duplicate++;
            continue;
          }
        }

        // Check for existing participants in database
        const existingError = await checkExistingParticipant(email, name);
        if (existingError) {
          errors.push(`Row ${i + 2}: ${existingError}`);
          stats.skipped.validation++;
          continue;
        }

        if (isPublicRoom) {
          processedNames.add(name);
        } else {
          processedEmails.add(email);
        }

        participants.push({
          name: name,
          email: isPublicRoom ? null : email,
          phone: row.phone?.trim() || '',
          org: row.org?.trim() || '',
          photourl: row.photourl?.trim() || '',
          desc: row.desc?.trim() || '',
          roomid: roomId
        });
      }

      if (participants.length === 0) {
        setMsg(`No valid participants to add.\nStats:\nTotal rows: ${stats.total}\nSkipped (validation errors): ${stats.skipped.validation}\nSkipped (duplicates): ${stats.skipped.duplicate}`);
        setBulkLoading(false);
        return;
      }

      // Insert participants in batches
      const batchSize = 50;
      for (let i = 0; i < participants.length; i += batchSize) {
        const batch = participants.slice(i, i + batchSize);
        const { error } = await supabase.from("Profiles").insert(batch);
        
        if (error) {
          throw error;
        }
      }

      stats.added = participants.length;
      setMsg(`Upload Summary:\nTotal rows: ${stats.total}\nSuccessfully added: ${stats.added}\nSkipped (validation errors): ${stats.skipped.validation}\nSkipped (duplicates): ${stats.skipped.duplicate}\n${errors.length > 0 ? '\nValidation Errors:\n' + errors.join('\n') : ''}`);
      setBulkFile(null);
      // Reset file input
      const fileInput = document.getElementById('bulkUpload');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error("Error processing bulk upload:", error);
      setMsg(error.message || "Error processing bulk upload");
    } finally {
      setBulkLoading(false);
      setTimeout(() => setMsg(null), 5000); // Increased timeout for longer messages
    }
  };

  const addParticipant = async () => {
    // Check required fields based on room type
    if (!name || (!isPublicRoom && !email)) {
      setMsg(`Please fill in required fields: ${isPublicRoom ? 'name' : 'name and email'}`);
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    // Validate fields
    const validationError = validateParticipant({
      name,
      email,
      phone,
      org,
      photourl: photoUrl
    });

    if (validationError) {
      setMsg(validationError);
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    try {
      setLoading(true);
      setMsg(null);

      // Check for existing participant
      const existingError = await checkExistingParticipant(email, name);
      if (existingError) {
        setMsg(existingError);
        setLoading(false);
        setTimeout(() => setMsg(null), 3000);
        return;
      }

      const { error } = await supabase.from("Profiles").insert([
        {
          name: name.trim(),
          email: isPublicRoom ? null : email.trim().toLowerCase(),
          phone: phone.trim(),
          org: org.trim(),
          photourl: photoUrl.trim(),
          desc: desc.trim(),
          roomid: roomId
        },
      ]);

      if (error) {
        console.error("Error adding participant:", error.message);
        setMsg(error.message);
      } else {
        setMsg("Participant added successfully");
        clear(); // Reset fields after successful addition
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setMsg("An unexpected error occurred");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <>
      <Link href="/rooms" className="mb-3 underline">All Rooms</Link><br />
      
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="fill"
            className="w-full px-3 py-3 my-3 bg-[#1c1c1c] font-semibold text-sm"
          >
            Add Single Participant +
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] border-gray-700 bg-[#1d1d1d]">
          <DialogHeader>
            <DialogTitle>Add New Participant</DialogTitle>
            <DialogDescription>
              {isPublicRoom 
                ? "Create a new participant profile here. Only name is required for this public room."
                : "Create a new participant profile here. Name and email are required. Name and email must be unique within the room."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="name" className="text-left">
                Name*
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                id="name"
                className="col-span-3"
              />
            </div>
            {isPublicRoom ? (
              <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="org" className="text-left">
                Role
              </Label>
              <Input
                id="org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                className="col-span-3"
              />
            </div>
            ) : (
              <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="org" className="text-left">
                Organization
              </Label>
              <Input
                id="org"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                className="col-span-3"
              />
            </div>
            )}
            
            {!isPublicRoom && (
              <>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="email" className="text-left">
                  Email*
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  id="email"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="phone" className="text-left">
                Phone no.
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="photo" className="text-left">
                Photo URL
              </Label>
              <Input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                id="photo"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="desc" className="text-left">
                Description
              </Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                id="desc"
                className="col-span-3"
              />
            </div>
            </>
            )}
            
          </div>
          <span className="text-gray-500">{msg}</span>
          <DialogFooter>
            {loading ? (
              <Button disabled className="disabled cursor-not-allowed">
                Adding . . . 
              </Button>
            ) : (
              <Button onClick={addParticipant}>Add</Button>
            )}
            <Button onClick={clear}>Clear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="fill"
            className="w-full px-3 py-3 my-3 bg-[#1c1c1c] font-semibold text-sm"
          >
            Bulk Add Participants +
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] border-gray-700 bg-[#1d1d1d]">
          <DialogHeader>
            <DialogTitle>Bulk Add Participants</DialogTitle>
            <DialogDescription>
              {isPublicRoom 
                ? "Upload a CSV file with participant details. Required column: name*. Optional: phone, org, photourl, desc. Column names are case-insensitive and spaces are trimmed."
                : "Upload a CSV file with participant details. Required columns: name*, email*. Optional: phone, org, photourl, desc. Column names are case-insensitive and spaces are trimmed. Duplicate emails will be skipped."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="bulkUpload" className="text-left">
                CSV File
              </Label>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleBulkUpload}
                id="bulkUpload"
                className="col-span-3"
              />
            </div>
          </div>
          <span className="text-gray-500 whitespace-pre-line">{msg}</span>
          <DialogFooter>
            {bulkLoading ? (
              <Button disabled className="disabled cursor-not-allowed">
                Processing . . . 
              </Button>
            ) : (
              <Button onClick={processBulkUpload}>Upload & Process</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ParticipantsDialogue;
